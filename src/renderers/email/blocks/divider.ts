import type { DividerNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { wrapWithSpacing } from "../table.js";

export function renderEmailDivider(node: DividerNode): string {
  const { color, thicknessPx, width, align, style, spacing, margin } =
    node.props;
  const widthAttr =
    width.unit === "px" ? String(width.value) : `${width.value}%`;
  const cellStyle = serializeInlineStyle([
    ["font-size", "0"],
    ["line-height", "0"],
    ["border-top", `${thicknessPx}px ${style} ${color}`],
  ]);
  const rule =
    `<table role="presentation" width="${widthAttr}" cellpadding="0" cellspacing="0" border="0" align="${align}">` +
    `<tr><td style="${cellStyle}">&nbsp;</td></tr></table>`;
  return wrapWithSpacing(spacing, rule, align, margin);
}
