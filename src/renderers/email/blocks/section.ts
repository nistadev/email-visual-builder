import type { EmailVisualDocument, SectionNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import {
  backgroundStyleEntries,
  shadowStyleEntries,
  spacingStyleEntries,
} from "../../style.js";
import type { RendererContext } from "../../traversal.js";
import { renderEmailNode } from "../render-node.js";
import { wrapWithMargin } from "../table.js";

export function renderEmailSection(
  node: SectionNode,
  document: EmailVisualDocument,
  context: RendererContext,
): string {
  const { background, contentWidth, spacing, margin, align, shadow } =
    node.props;
  const childrenHtml = (node.children ?? [])
    .map((childId) => renderEmailNode(childId, document, context))
    .join("");

  const outerStyle = serializeInlineStyle([
    ...backgroundStyleEntries(background),
    ...shadowStyleEntries(shadow),
  ]);
  const innerWidthAttr =
    contentWidth.unit === "px"
      ? String(contentWidth.value)
      : `${contentWidth.value}%`;
  const innerStyle = serializeInlineStyle(spacingStyleEntries(spacing));
  const innerTableStyleValue = serializeInlineStyle([
    ["width", contentWidth.unit === "px" ? "100%" : null],
    [
      "max-width",
      contentWidth.unit === "px" ? `${contentWidth.value}px` : null,
    ],
    ["margin", align === "center" ? "0 auto" : null],
  ]);
  const innerTableStyle = innerTableStyleValue
    ? ` style="${innerTableStyleValue}"`
    : "";

  const section =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${outerStyle}">` +
    `<tr><td align="${align}">` +
    `<table role="presentation" width="${innerWidthAttr}" cellpadding="0" cellspacing="0" border="0" align="${align}"${innerTableStyle}>` +
    `<tr><td style="${innerStyle}">${childrenHtml}</td></tr></table>` +
    `</td></tr></table>`;
  return wrapWithMargin(margin, section, align);
}
