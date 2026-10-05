import type { CtaNode, VisualDocumentLinkStyle } from "../../../types/index.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import {
  shadowStyleEntries,
  spacingStyleEntries,
  typographyStyleEntries,
} from "../../style.js";
import { renderTemplatedValueAsText } from "../../templated-text.js";
import { renderRichTextInlineHtml } from "../rich-text-html.js";
import { wrapWithMargin } from "../table.js";

/** Bulletproof table-button pattern — an anchor styled as a block button inside its own presentation table, per design.md decision #11. */
export function renderEmailCta(
  node: CtaNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const {
    label,
    destination,
    typography,
    backgroundColor,
    align,
    width,
    borderRadiusPx,
    spacing,
    margin,
    shadow,
  } = node.props;

  const href = renderTemplatedValueAsText(destination, escapeHtmlAttribute);
  const labelHtml = renderRichTextInlineHtml(label, linkStyle, false);

  const tableWidthAttr =
    width.unit === "auto"
      ? ""
      : ` width="${width.unit === "px" ? width.value : `${width.value}%`}"`;
  const anchorStyle = serializeInlineStyle([
    ...typographyStyleEntries(typography),
    ["display", "inline-block"],
    ...spacingStyleEntries(spacing),
    ["background-color", backgroundColor],
    ["border-radius", `${borderRadiusPx}px`],
    ["text-decoration", "none"],
    ["text-align", "center"],
  ]);
  const cellStyle = serializeInlineStyle([
    ["border-radius", `${borderRadiusPx}px`],
    ["background-color", backgroundColor],
  ]);
  const tableStyle = serializeInlineStyle(shadowStyleEntries(shadow));
  const tableStyleAttribute = tableStyle ? ` style="${tableStyle}"` : "";

  const button =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}"${tableWidthAttr}${tableStyleAttribute}>` +
    `<tr><td style="${cellStyle}" align="center">` +
    `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${anchorStyle}">${labelHtml || "&nbsp;"}</a>` +
    `</td></tr></table>`;

  return wrapWithMargin(margin, button, align);
}
