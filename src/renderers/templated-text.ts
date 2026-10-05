// Renders an already-validated `TemplatedValue` as escaped output text
// (design.md decision #8, task 9.5). Variable segments emit their exact
// configured token verbatim (still passed through the context-appropriate
// escaper, which is a no-op for the package's percent-delimited token
// alphabet) so the existing recipient-substitution worker can resolve them
// unchanged after render.

import type { TemplatedValue } from "../types/index.js";

export function renderTemplatedValueAsText(
  value: TemplatedValue,
  escape: (text: string) => string,
): string {
  return value.segments
    .map((segment) =>
      segment.kind === "literal"
        ? escape(segment.value)
        : escape(segment.token),
    )
    .join("");
}
