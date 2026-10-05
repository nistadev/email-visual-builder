import type { RichTextNode, VisualDocumentLinkStyle } from "../../../types/index.js";
import { renderRichTextHtml } from "../rich-text-html.js";
import { wrapWithSpacing } from "../wrap.js";
import { serializeInlineStyle } from "../../escape.js";
import { spacingStyleEntries } from "../../style.js";

export function renderLandingRichText(
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
    ? `<div style="${serializeInlineStyle([
        ["border", `${borderWidth}px solid ${borderColor}`],
        [
          "border-radius",
          borderRadiusByCorner
            ? `${borderTopLeftRadiusPx}px ${borderTopRightRadiusPx}px ${borderBottomRightRadiusPx}px ${borderBottomLeftRadiusPx}px`
            : `${borderRadiusPx}px`,
        ],
        ...spacingStyleEntries(spacing),
      ])}">${content}</div>`
    : content;
  return border
    ? wrapWithSpacing(
        { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        bordered,
        "left",
        margin,
      )
    : wrapWithSpacing(spacing, content, "left", margin);
}
