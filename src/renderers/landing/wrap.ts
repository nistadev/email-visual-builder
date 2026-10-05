import type { HorizontalAlignment, SpacingValue } from "../../types/index.js";
import { serializeInlineStyle } from "../escape.js";
import { marginStyleEntries, spacingStyleEntries } from "../style.js";

/** The landing equivalent of the email renderer's table-based `wrapWithSpacing` — a plain `<div>` since landing layout has no email-client table constraint. */
export function wrapWithSpacing(
  spacing: SpacingValue,
  innerHtml: string,
  align: HorizontalAlignment = "left",
  margin: SpacingValue = { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
): string {
  const style = serializeInlineStyle([
    ...spacingStyleEntries(spacing),
    ...marginStyleEntries(margin),
    ["text-align", align],
  ]);
  return `<div style="${style}">${innerHtml}</div>`;
}
