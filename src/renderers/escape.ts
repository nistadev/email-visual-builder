// Context-specific escaping and deterministic inline-style serialization
// (design.md decision #16, task 8.1). Renderers must never interpolate
// authored/variable text into HTML/CSS output without passing through one of
// these — that is the package's only defense against stored-content XSS.

/**
 * Escapes text for an HTML text node (element content, never inside a tag).
 */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes text for a double-quoted HTML attribute value. Renderers must
 * always wrap attribute values in double quotes; this does not escape
 * single quotes.
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escapes a value for use inside a `style="..."` attribute or a scoped
 * `<style>` block. CSS values here are always structured, validated
 * presentation data (a hex color, a font-family list, a pixel number) —
 * never arbitrary author-supplied CSS — so this is a conservative character
 * strip rather than a full CSS-value grammar: anything that could terminate
 * the declaration, the attribute, or the surrounding tag is removed.
 */
export function escapeCssValue(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] as string;
    const code = value.charCodeAt(index);
    const isControlChar = code <= 31 || code === 127;
    const isUnsafeChar =
      char === ";" ||
      char === "{" ||
      char === "}" ||
      char === "<" ||
      char === ">" ||
      char === '"' ||
      char === "'" ||
      char === "\\";
    if (isControlChar || isUnsafeChar) continue;
    result += char;
  }
  return result.trim();
}

export type StyleEntry = readonly [
  property: string,
  value: string | number | null | undefined,
];

const CSS_PROPERTY_NAME_PATTERN = /^-?[a-z][a-z-]*$/;

/**
 * Joins ordered `[property, value]` pairs into a deterministic inline style
 * string, skipping nullish values. Property names are always hardcoded by
 * renderer code (never authored data) but are still validated against a
 * strict pattern as a defense-in-depth invariant check. Order is preserved
 * exactly as given — callers control property order, not this function —
 * so repeated calls with the same input are always byte-identical.
 */
export function serializeInlineStyle(entries: readonly StyleEntry[]): string {
  const parts: string[] = [];
  for (const [property, value] of entries) {
    if (value === null || value === undefined) continue;
    if (!CSS_PROPERTY_NAME_PATTERN.test(property)) {
      throw new Error(
        `Invalid CSS property name "${property}" passed to serializeInlineStyle.`,
      );
    }
    const rawValue = typeof value === "number" ? String(value) : value;
    const safeValue = escapeCssValue(rawValue);
    if (safeValue.length === 0) continue;
    parts.push(`${property}:${safeValue};`);
  }
  return parts.join("");
}
