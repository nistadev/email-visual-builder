import type { HeadingNode, VisualDocumentLinkStyle } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { typographyStyleEntries } from "../../style.js";
import { renderRichTextInlineHtml } from "../rich-text-html.js";
import { wrapWithSpacing } from "../table.js";

export function renderEmailHeading(
  node: HeadingNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const { level, text, typography, spacing, margin, align } = node.props;
  const style = serializeInlineStyle([
    ...typographyStyleEntries(typography),
    ["margin", "0"],
    ["text-align", align],
  ]);
  const content = renderRichTextInlineHtml(text, linkStyle);
  const heading = `<h${level} style="${style}">${content || "&nbsp;"}</h${level}>`;
  return wrapWithSpacing(spacing, heading, align, margin);
}
