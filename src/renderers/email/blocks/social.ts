import type { SocialNode } from "../../../types/index.js";
import type { SocialIconPlatform } from "../../../core/blocks/social-icon-assets.generated.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import {
  resolveSocialItemStyle,
  socialItemAltText,
} from "../../social-icon-style.js";
import { wrapWithSpacing } from "../table.js";

/**
 * One-row, non-wrapping `<table>` of icon cells — mail clients render
 * `display:flex`/`gap` unreliably, so layout uses the same table-cell
 * technique as every other email block. Delivery renders use public PNG URLs
 * because many mail clients strip data URIs and inline SVGs.
 */
export function renderEmailSocial(
  node: SocialNode,
  emailAssetBaseUrl?: string,
): string {
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

  const cells = items
    .map((item, index) => {
      const platform = item.platform as SocialIconPlatform;
      const style = resolveSocialItemStyle(
        platform,
        iconStyle,
        shape,
        iconSizePx,
        color,
        glyphTone,
        emailAssetBaseUrl,
      );
      const cellStyle = serializeInlineStyle([
        ["padding-left", index === 0 ? undefined : `${gapPx}px`],
      ]);
      const wrapperStyle = serializeInlineStyle([
        ["width", `${style.wrapperSizePx}px`],
        ["height", `${style.wrapperSizePx}px`],
        ["background-color", style.backgroundColor ?? undefined],
        ["border-radius", style.borderRadiusCss],
        ["text-align", "center"],
        ["line-height", `${style.wrapperSizePx}px`],
      ]);
      const imgStyle = serializeInlineStyle([
        ["width", `${style.imgSizePx}px`],
        ["height", `${style.imgSizePx}px`],
        ["vertical-align", "middle"],
        ["border", "0"],
      ]);
      let iconHtml =
        `<img src="${style.imgSrc}" width="${style.imgSizePx}" height="${style.imgSizePx}" ` +
        `alt="${escapeHtmlAttribute(socialItemAltText(platform))}" style="${imgStyle}">`;
      const url = item.url.trim();
      if (url) {
        const href = escapeHtmlAttribute(url);
        iconHtml = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${iconHtml}</a>`;
      }
      return `<td style="${cellStyle}"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="${wrapperStyle}">${iconHtml}</td></tr></table></td>`;
    })
    .join("");

  const alignAttr =
    align === "center" ? "center" : align === "right" ? "right" : "left";
  const rowHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${alignAttr}"><tr>${cells}</tr></table>`;

  return wrapWithSpacing(spacing, rowHtml, align, margin);
}
