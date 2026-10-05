import type { ImageNode } from "../../../types/index.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import { renderTemplatedValueAsText } from "../../templated-text.js";
import { externalLinkAttributes } from "../external-link.js";
import { wrapWithSpacing } from "../wrap.js";

/** No uploaded asset yet — nothing to publish, so this renders nothing (same policy as the email renderer). */
export function renderLandingImage(node: ImageNode): string {
  const {
    asset,
    altText,
    displayWidth,
    align,
    link,
    borderRadiusPx,
    borderRadiusByCorner,
    borderTopLeftRadiusPx,
    borderTopRightRadiusPx,
    borderBottomRightRadiusPx,
    borderBottomLeftRadiusPx,
    spacing,
    margin,
  } = node.props;
  if (!asset) return "";

  const widthStyleValue =
    displayWidth.unit === "px"
      ? `${displayWidth.value}px`
      : `${displayWidth.value}%`;
  const widthAttr =
    displayWidth.unit === "px" ? ` width="${displayWidth.value}"` : "";
  const borderRadius = borderRadiusByCorner
    ? `${borderTopLeftRadiusPx}px ${borderTopRightRadiusPx}px ${borderBottomRightRadiusPx}px ${borderBottomLeftRadiusPx}px`
    : `${borderRadiusPx}px`;
  const imgStyle = serializeInlineStyle([
    ["width", widthStyleValue],
    ["max-width", "100%"],
    ["height", "auto"],
    ["border-radius", borderRadius],
  ]);
  let imgHtml = `<img src="${escapeHtmlAttribute(asset.url)}" alt="${escapeHtmlAttribute(altText)}" style="${imgStyle}"${widthAttr} loading="lazy">`;

  if (link) {
    const href = renderTemplatedValueAsText(link, escapeHtmlAttribute);
    imgHtml = `<a href="${href}"${externalLinkAttributes(href)}>${imgHtml}</a>`;
  }

  return wrapWithSpacing(spacing, imgHtml, align, margin);
}
