// Small presentation-table helpers shared by every email block renderer
// (design.md decision #11, task 9.1-9.3). Every content block wraps itself
// in a full-width `role="presentation"` table carrying its own `spacing` as
// cell padding — container blocks (`section`/`columns`) then just
// concatenate their children's HTML directly, with no extra row wrapping.

import type { HorizontalAlignment, SpacingValue } from "../../types/index.js";
import { serializeInlineStyle } from "../escape.js";
import { spacingStyleEntries } from "../style.js";

/** Email-safe margin: an outer cell uses padding because many mail clients ignore CSS margin on content/table elements. */
export function wrapWithMargin(
  margin: SpacingValue,
  innerHtml: string,
  align: HorizontalAlignment = "left",
): string {
  if (
    margin.topPx === 0 &&
    margin.rightPx === 0 &&
    margin.bottomPx === 0 &&
    margin.leftPx === 0
  ) {
    return innerHtml;
  }
  const style = serializeInlineStyle([
    ...spacingStyleEntries(margin),
    ["text-align", align],
  ]);
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="${style}">${innerHtml}</td></tr></table>`
  );
}

/** Wraps `innerHtml` in a single-cell presentation table applying authored padding, then an optional email-safe outer margin. */
export function wrapWithSpacing(
  spacing: SpacingValue,
  innerHtml: string,
  align: HorizontalAlignment = "left",
  margin: SpacingValue = { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
): string {
  const style = serializeInlineStyle([
    ...spacingStyleEntries(spacing),
    ["text-align", align],
  ]);
  const padded =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="${style}">${innerHtml}</td></tr></table>`;
  return wrapWithMargin(margin, padded, align);
}
