import type { ColumnsNode, LandingPageVisualDocument } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import {
  backgroundStyleEntries,
  marginStyleEntries,
  spacingStyleEntries,
} from "../../style.js";
import type { RendererContext } from "../../traversal.js";
import { LANDING_MOBILE_BREAKPOINT_PX } from "../constants.js";
import { renderLandingNode } from "../render-node.js";
import { wrapWithSpacing } from "../wrap.js";

/**
 * A responsive CSS grid, one track per configured column ratio. A
 * deterministic `@media` rule collapses it to a single column below the
 * breakpoint when `responsiveStack === "stack"` (task 10.2).
 */
export function renderLandingColumns(
  node: ColumnsNode,
  document: LandingPageVisualDocument,
  context: RendererContext,
): string {
  const { columnWidthRatios, responsiveStack, spacing, margin } = node.props;
  const columnIds = node.children ?? [];

  const gridClass = context.nextClassName("vb-grid");
  if (responsiveStack === "stack" && columnIds.length > 0) {
    context.addMediaRule(
      `@media (max-width:${LANDING_MOBILE_BREAKPOINT_PX}px){.${gridClass}{grid-template-columns:1fr !important;}}`,
    );
  }

  const templateColumns = columnWidthRatios
    .map((ratio) => `${ratio}fr`)
    .join(" ");
  const gridStyle = serializeInlineStyle([
    ["display", "grid"],
    ["grid-template-columns", templateColumns],
    ["gap", "0"],
  ]);

  const cells = columnIds
    .map((columnId) => {
      const columnNode = document.nodes[columnId];
      if (
        !columnNode ||
        "unavailable" in columnNode ||
        columnNode.type !== "column"
      )
        return "";
      const childrenHtml = (columnNode.children ?? [])
        .map((childId) => renderLandingNode(childId, document, context))
        .join("");
      const cellStyle = serializeInlineStyle([
        ...marginStyleEntries(columnNode.props.margin),
      ]);
      const contentStyle = serializeInlineStyle([
        ...backgroundStyleEntries(columnNode.props.background),
        ...spacingStyleEntries(columnNode.props.spacing),
      ]);
      return `<div style="${cellStyle}"><div style="${contentStyle}">${childrenHtml}</div></div>`;
    })
    .join("");

  const grid = `<div class="${gridClass}" style="${gridStyle}">${cells}</div>`;
  return wrapWithSpacing(spacing, grid, "left", margin);
}
