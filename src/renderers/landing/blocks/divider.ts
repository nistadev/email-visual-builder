import type { DividerNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { wrapWithSpacing } from "../wrap.js";

export function renderLandingDivider(node: DividerNode): string {
  const { color, thicknessPx, width, align, style, spacing, margin } =
    node.props;
  const widthValue =
    width.unit === "px" ? `${width.value}px` : `${width.value}%`;
  const margins =
    align === "center"
      ? "0 auto"
      : align === "right"
        ? "0 0 0 auto"
        : "0 auto 0 0";
  const hrStyle = serializeInlineStyle([
    ["border", "none"],
    ["border-top", `${thicknessPx}px ${style} ${color}`],
    ["width", widthValue],
    ["margin", margins],
  ]);
  return wrapWithSpacing(spacing, `<hr style="${hrStyle}">`, align, margin);
}
