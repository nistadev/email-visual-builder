// Context-aware URL parsing/normalization (design.md decisions #8, #12;
// task 7.4). Values are parsed rather than checked by substring — every
// rejection below is a structural decision (recognized scheme, well-formed
// authority), not a denylist regex over the raw string.

import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { err, issue, ok, type ParseResult } from "./result.js";

/** Absolute schemes ever permitted, regardless of context. */
const ALLOWED_ABSOLUTE_SCHEMES = new Set([
  "https:",
  "http:",
  "mailto:",
  "tel:",
]);

const LEADING_SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * True if `value` contains a C0 control character (tab, newline, carriage
 * return, and friends), which is never valid in a stored URL and is the
 * classic scheme-obfuscation vector: browsers historically strip these
 * characters before scheme-sniffing, so an unsafe scheme can be split across
 * them to slip past a naive text check. Checked by character code, not a
 * regex control-character class, to keep the source plain text.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isC0 = code <= 31;
    const isDelete = code === 127;
    if (isC0 || isDelete) return true;
  }
  return false;
}

export interface UrlValidationOptions {
  /** Permits `/path`, `?query`, and `#anchor` destinations (the landing mode's same-page/relative policy). Protocol-relative (`//host`) is always rejected regardless. */
  allowRelative?: boolean;
}

/**
 * Validates and normalizes a single fully-literal URL (no unresolved
 * variable segments). Trims surrounding whitespace; rejects control
 * characters, embedded whitespace, protocol-relative destinations, and any
 * scheme outside `https:`/`http:`/`mailto:`/`tel:` (which covers
 * `javascript:`, `data:`, `vbscript:`, and every other disallowed or
 * malformed scheme).
 */
export function validateSafeUrl(
  raw: string,
  path: string,
  options: UrlValidationOptions = {},
): ParseResult<string> {
  if (hasControlCharacter(raw)) {
    return err([
      issue(
        "value/unsafe-url-control-characters",
        `URL at "${path}" contains control characters.`,
        { path },
      ),
    ]);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err([
      issue("value/empty-url", `URL at "${path}" must not be empty.`, { path }),
    ]);
  }
  if (trimmed.length > VISUAL_DOCUMENT_LIMITS.maxStringLength) {
    return err([
      issue(
        "value/string-too-long",
        `URL at "${path}" exceeds the maximum length.`,
        { path },
      ),
    ]);
  }
  if (trimmed.includes(" ")) {
    return err([
      issue(
        "value/unsafe-url-whitespace",
        `URL at "${path}" must not contain embedded whitespace.`,
        { path },
      ),
    ]);
  }

  const schemeMatch = LEADING_SCHEME_PATTERN.exec(trimmed);
  if (schemeMatch?.[1]) {
    const scheme = schemeMatch[1].toLowerCase();
    if (!ALLOWED_ABSOLUTE_SCHEMES.has(`${scheme}:`)) {
      return err([
        issue(
          "value/disallowed-url-scheme",
          `URL at "${path}" uses a disallowed scheme "${scheme}:".`,
          { path },
        ),
      ]);
    }
    try {
      new URL(trimmed);
    } catch {
      return err([
        issue(
          "value/malformed-url",
          `URL at "${path}" is not a well-formed "${scheme}:" URL.`,
          { path },
        ),
      ]);
    }
    return ok(trimmed);
  }

  if (trimmed.startsWith("//")) {
    return err([
      issue(
        "value/disallowed-url-scheme",
        `URL at "${path}" is protocol-relative, which is never allowed.`,
        { path },
      ),
    ]);
  }
  if (trimmed.includes("\\")) {
    return err([
      issue(
        "value/unsafe-url-backslash",
        `URL at "${path}" must not contain backslashes.`,
        { path },
      ),
    ]);
  }
  if (!options.allowRelative) {
    return err([
      issue(
        "value/relative-url-not-allowed",
        `Relative destination at "${path}" is not allowed in this context.`,
        { path },
      ),
    ]);
  }
  if (!(
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?")
  )) {
    return err([
      issue(
        "value/relative-url-not-allowed",
        `Destination at "${path}" must start with "/", "?", or "#".`,
        { path },
      ),
    ]);
  }
  return ok(trimmed);
}
