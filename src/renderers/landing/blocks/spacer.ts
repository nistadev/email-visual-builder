import type { SpacerNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { marginStyleEntries } from "../../style.js";

export function renderLandingSpacer(node: SpacerNode): string {
  const { heightPx, width, align, margin } = node.props;
  const widthValue =
    width.unit === "px" ? `${width.value}px` : `${width.value}%`;
  const margins =
    align === "center"
      ? "0 auto"
      : align === "right"
        ? "0 0 0 auto"
        : "0 auto 0 0";
  const style = serializeInlineStyle([
    ["height", `${heightPx}px`],
    ["width", widthValue],
    ["margin", margins],
  ]);
  const wrapperStyle = serializeInlineStyle(marginStyleEntries(margin));
  return `<div style="${wrapperStyle}"><div style="${style}" aria-hidden="true"></div></div>`;
}
