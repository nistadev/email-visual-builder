import type { SpacerNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import { wrapWithMargin } from "../table.js";

/** No `spacing` prop on `spacer` — its height *is* the block, so it skips the shared `wrapWithSpacing` padding wrapper. */
export function renderEmailSpacer(node: SpacerNode): string {
  const { heightPx, width, align, margin } = node.props;
  const widthAttr =
    width.unit === "px" ? String(width.value) : `${width.value}%`;
  const cellStyle = serializeInlineStyle([
    ["font-size", "0"],
    ["line-height", `${heightPx}px`],
    ["height", `${heightPx}px`],
  ]);
  const spacer =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td align="${align}">` +
    `<table role="presentation" width="${widthAttr}" cellpadding="0" cellspacing="0" border="0" align="${align}">` +
    `<tr><td style="${cellStyle}">&nbsp;</td></tr></table>` +
    `</td></tr></table>`;
  return wrapWithMargin(margin, spacer, align);
}
