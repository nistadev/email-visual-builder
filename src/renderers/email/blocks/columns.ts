import type { ColumnsNode, EmailVisualDocument } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { backgroundStyleEntries, spacingStyleEntries } from "../../style.js";
import type { RendererContext } from "../../traversal.js";
import { EMAIL_MOBILE_BREAKPOINT_PX } from "../constants.js";
import { renderEmailNode } from "../render-node.js";
import { wrapWithMargin, wrapWithSpacing } from "../table.js";

/**
 * Renders one `<td>` per configured column, each carrying its own
 * background/spacing and a deterministic stacking class when
 * `responsiveStack === "stack"` — the matching `@media` rule is collected on
 * `context` and emitted once in the document `<head>` (task 9.4).
 */
export function renderEmailColumns(
  node: ColumnsNode,
  document: EmailVisualDocument,
  context: RendererContext,
): string {
  const { columnWidthRatios, responsiveStack, spacing, margin } = node.props;
  const columnIds = node.children ?? [];

  let stackClass: string | null = null;
  if (responsiveStack === "stack" && columnIds.length > 0) {
    stackClass = context.nextClassName("vb-col-stack");
    context.addMediaRule(
      `@media only screen and (max-width:${EMAIL_MOBILE_BREAKPOINT_PX}px){.${stackClass}{display:block !important;width:100% !important;}}`,
    );
  }

  const evenRatio =
    columnIds.length > 0 ? Math.floor(100 / columnIds.length) : 100;
  const cells = columnIds
    .map((columnId, index) => {
      const columnNode = document.nodes[columnId];
      if (
        !columnNode ||
        "unavailable" in columnNode ||
        columnNode.type !== "column"
      )
        return "";
      const ratio = columnWidthRatios[index] ?? evenRatio;
      const childrenHtml = (columnNode.children ?? [])
        .map((childId) => renderEmailNode(childId, document, context))
        .join("");
      const contentStyle = serializeInlineStyle([
        ...backgroundStyleEntries(columnNode.props.background),
        ...spacingStyleEntries(columnNode.props.spacing),
      ]);
      const cellStyle = serializeInlineStyle([["vertical-align", "top"]]);
      const content =
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
        `<tr><td style="${contentStyle}">${childrenHtml}</td></tr></table>`;
      const classAttr = stackClass ? ` class="${stackClass}"` : "";
      return `<td width="${ratio}%" style="${cellStyle}"${classAttr}>${wrapWithMargin(columnNode.props.margin, content)}</td>`;
    })
    .join("");

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
  return wrapWithSpacing(spacing, table, "left", margin);
}
