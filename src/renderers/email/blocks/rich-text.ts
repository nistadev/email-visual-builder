import type { RichTextNode, VisualDocumentLinkStyle } from "../../../types/index.js";
import { renderRichTextHtml } from "../rich-text-html.js";
import { wrapWithMargin, wrapWithSpacing } from "../table.js";
import { serializeInlineStyle } from "../../escape.js";
import { spacingStyleEntries } from "../../style.js";

export function renderEmailRichText(
  node: RichTextNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const {
    value,
    typography,
    spacing,
    margin,
    border,
    borderWidth,
    borderColor,
    borderRadiusPx,
    borderRadiusByCorner,
    borderTopLeftRadiusPx,
    borderTopRightRadiusPx,
    borderBottomRightRadiusPx,
    borderBottomLeftRadiusPx,
  } = node.props;
  const html = renderRichTextHtml(value, typography, linkStyle);
  const content = html || "&nbsp;";
  const bordered = border
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${serializeInlineStyle(
        [
          ["border", `${borderWidth}px solid ${borderColor}`],
          [
            "border-radius",
            borderRadiusByCorner
              ? `${borderTopLeftRadiusPx}px ${borderTopRightRadiusPx}px ${borderBottomRightRadiusPx}px ${borderBottomLeftRadiusPx}px`
              : `${borderRadiusPx}px`,
          ],
        ],
      )}"><tr><td style="${serializeInlineStyle(spacingStyleEntries(spacing))}">${content}</td></tr></table>`
    : content;
  return border
    ? wrapWithMargin(margin, bordered)
    : wrapWithSpacing(spacing, content, "left", margin);
}
