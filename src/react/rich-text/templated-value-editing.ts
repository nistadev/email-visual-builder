// Bidirectional conversion between a `TemplatedValue` and a single editable
// string, used for link destinations inside the rich-text adapter (a
// Lexical `LinkNode` only stores one `url` string, not literal/variable
// segments). Round-tripping through the variable registry's exact tokens
// keeps the two representations equivalent without persisting Lexical state.

import type { TemplatedValue, TemplatedSegment } from "../../types/index.js";
import type { VariableRegistry } from "../../core/registry/types.js";

export function templatedValueToEditableString(value: TemplatedValue): string {
  return value.segments
    .map((segment) =>
      segment.kind === "literal" ? segment.value : segment.token,
    )
    .join("");
}

/** Unresolved percent-style matches are kept as literal text — core's `checkLiteralTextForUnresolvedVariables` flags them at export, this never silently drops content. */
export function editableStringToTemplatedValue(
  text: string,
  registry: VariableRegistry,
): TemplatedValue {
  const pattern = registry.syntax.pattern;
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);

  const segments: TemplatedSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(globalPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      segments.push({ kind: "literal", value: text.slice(lastIndex, index) });
    const token = match[0];
    const definition = registry
      .list()
      .find((candidate) => candidate.token === token);
    if (definition) {
      segments.push({
        kind: "variable",
        variableKey: definition.key,
        token: definition.token,
      });
    } else {
      segments.push({ kind: "literal", value: token });
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length)
    segments.push({ kind: "literal", value: text.slice(lastIndex) });
  if (segments.length === 0) segments.push({ kind: "literal", value: "" });
  return { segments };
}
