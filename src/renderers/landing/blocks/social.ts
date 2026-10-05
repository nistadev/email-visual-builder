import type { SocialNode } from "../../../types/index.js";
import type { SocialIconPlatform } from "../../../core/blocks/social-icon-assets.generated.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import {
  resolveSocialItemStyle,
  socialItemAltText,
} from "../../social-icon-style.js";
import { externalLinkAttributes } from "../external-link.js";
import { wrapWithSpacing } from "../wrap.js";

const ALIGN_TO_JUSTIFY: Record<SocialNode["props"]["align"], string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/** Flex row with `flex-wrap` (design.md "Landing-page responsive rendering") so the icon row never overflows a narrow viewport. */
export function renderLandingSocial(node: SocialNode): string {
  const {
    items,
    iconStyle,
    shape,
    color,
    glyphTone,
    iconSizePx,
    gapPx,
    align,
    spacing,
    margin,
  } = node.props;
  if (items.length === 0) return "";

  const icons = items
    .map((item) => {
      const platform = item.platform as SocialIconPlatform;
      const style = resolveSocialItemStyle(
        platform,
        iconStyle,
        shape,
        iconSizePx,
        color,
        glyphTone,
      );
      const wrapperStyle = serializeInlineStyle([
        ["width", `${style.wrapperSizePx}px`],
        ["height", `${style.wrapperSizePx}px`],
        ["background-color", style.backgroundColor ?? undefined],
        ["border-radius", style.borderRadiusCss],
        ["display", "flex"],
        ["align-items", "center"],
        ["justify-content", "center"],
      ]);
      const imgStyle = serializeInlineStyle([
        ["width", `${style.imgSizePx}px`],
        ["height", `${style.imgSizePx}px`],
      ]);
      let iconHtml =
        `<span style="${wrapperStyle}"><img src="${style.imgSrc}" width="${style.imgSizePx}" height="${style.imgSizePx}" ` +
        `alt="${escapeHtmlAttribute(socialItemAltText(platform))}" style="${imgStyle}" loading="lazy"></span>`;
      const url = item.url.trim();
      if (url) {
        const href = escapeHtmlAttribute(url);
        iconHtml = `<a href="${href}"${externalLinkAttributes(url)} style="text-decoration:none;">${iconHtml}</a>`;
      }
      return iconHtml;
    })
    .join("");

  const rowStyle = serializeInlineStyle([
    ["display", "flex"],
    ["flex-wrap", "wrap"],
    ["gap", `${gapPx}px`],
    ["justify-content", ALIGN_TO_JUSTIFY[align]],
  ]);
  const rowHtml = `<div style="${rowStyle}">${icons}</div>`;

  return wrapWithSpacing(spacing, rowHtml, align, margin);
}
