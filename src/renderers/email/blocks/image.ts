import type { ImageNode } from "../../../types/index.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import { renderTemplatedValueAsText } from "../../templated-text.js";
import { wrapWithSpacing } from "../table.js";

/**
 * An image block with no uploaded asset yet has no durable content to
 * deliver — rather than send a broken `<img>` icon, it renders nothing.
 * `collectLinkQualityWarnings`-style authoring-time feedback belongs to the
 * canvas (section 12), not the delivered document.
 */
export function renderEmailImage(node: ImageNode): string {
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

  const widthAttr =
    displayWidth.unit === "px" ? String(displayWidth.value) : undefined;
  const widthStyleValue =
    displayWidth.unit === "px"
      ? `${displayWidth.value}px`
      : `${displayWidth.value}%`;
  const borderRadius = borderRadiusByCorner
    ? `${borderTopLeftRadiusPx}px ${borderTopRightRadiusPx}px ${borderBottomRightRadiusPx}px ${borderBottomLeftRadiusPx}px`
    : `${borderRadiusPx}px`;
  const imgStyle = serializeInlineStyle([
    ["width", widthStyleValue],
    ["max-width", "100%"],
    ["height", "auto"],
    ["border", "0"],
    ["border-radius", borderRadius],
  ]);
  const widthAttribute = widthAttr ? ` width="${widthAttr}"` : "";
  let imgHtml = `<img src="${escapeHtmlAttribute(asset.url)}" alt="${escapeHtmlAttribute(altText)}" style="${imgStyle}"${widthAttribute}>`;

  if (link) {
    const href = renderTemplatedValueAsText(link, escapeHtmlAttribute);
    imgHtml = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${imgHtml}</a>`;
  }

  return wrapWithSpacing(spacing, imgHtml, align, margin);
}
