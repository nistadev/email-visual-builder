// Flags variable-like syntax found in literal text (design.md decision #8,
// task 7.3). Variables are only ever valid as atomic nodes/segments — literal
// text containing the configured syntax (e.g. a stray `%something%`) was
// never resolved through a real variable node, so it always blocks export,
// whether or not the matched substring happens to equal a real token.

import type { VisualDocumentValidationIssue } from "../../types/index.js";
import { issue } from "../result.js";
import type { VariableRegistry } from "../registry/types.js";
import { findVariableLikeMatches } from "./token-syntax.js";

export function checkLiteralTextForUnresolvedVariables(
  text: string,
  registry: VariableRegistry,
  path: string,
): VisualDocumentValidationIssue[] {
  const matches = findVariableLikeMatches(text, registry.syntax);
  return matches.map((match) =>
    issue(
      "value/unresolved-variable-like-text",
      `Text at "${path}" contains variable-like content "${match}" that was not inserted as a variable.`,
      { path },
    ),
  );
}
