// Configurable variable-like syntax recognition (design.md decision #8,
// task 7.3). The package never hardcodes a specific product's variable
// syntax — the consumer's marketing token format (`%recipient.firstName%`)
// is just the default, not a built-in assumption baked into parsing.

export interface VariableSyntaxDefinition {
  /**
   * Recognizes variable-like substrings in literal text. Must be a global
   * regex — callers reuse it across many scans via `findVariableLikeMatches`.
   */
  pattern: RegExp;
}

/** Percent-delimited tokens, e.g. `%recipient.firstName%` or `%mailing_list_unsubscribe_url%`. */
export const DEFAULT_VARIABLE_SYNTAX: VariableSyntaxDefinition = {
  pattern: /%[A-Za-z][A-Za-z0-9_.]*%/g,
};

/**
 * Returns every substring of `text` that looks like a variable token under
 * `syntax`, regardless of whether it resolves against any registry. Callers
 * cross-reference matches against known tokens to flag unresolved ones.
 */
export function findVariableLikeMatches(
  text: string,
  syntax: VariableSyntaxDefinition,
): string[] {
  const pattern = new RegExp(
    syntax.pattern.source,
    syntax.pattern.flags.includes("g")
      ? syntax.pattern.flags
      : `${syntax.pattern.flags}g`,
  );
  const matches: string[] = [];
  for (const match of text.matchAll(pattern)) {
    matches.push(match[0]);
  }
  return matches;
}
