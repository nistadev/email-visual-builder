// Resolves a persisted variable reference (a rich-text `RichTextVariableNode`
// or `TemplatedSegment` of kind "variable") against a `VariableRegistry`
// (design.md decision #8, task 7.2). Structural parsing already guarantees
// `variableKey`/`token` are non-empty strings — this is the semantic check
// that they still name a real, currently-registered variable whose exact
// token still matches what was persisted.

import type {
  VariableDefinition,
  VisualDocumentValidationIssue,
} from "../../types/index.js";
import { issue } from "../result.js";
import type { VariableRegistry } from "../registry/types.js";

export type VariableResolution =
  | { ok: true; definition: VariableDefinition }
  | { ok: false; issue: VisualDocumentValidationIssue };

/**
 * A variable reference is only valid when both its key resolves in the
 * active registry AND its persisted token still matches that definition's
 * exact token exactly — a registry that renamed a token without also
 * changing the key must not silently substitute the new one into old
 * content.
 */
export function resolveVariableReference(
  variableKey: string,
  token: string,
  registry: VariableRegistry,
  path: string,
): VariableResolution {
  const definition = registry.get(variableKey);
  if (!definition) {
    return {
      ok: false,
      issue: issue(
        "value/unknown-variable",
        `Variable "${variableKey}" at "${path}" is not present in the active variable registry.`,
        { path },
      ),
    };
  }
  if (definition.token !== token) {
    return {
      ok: false,
      issue: issue(
        "value/variable-token-mismatch",
        `Variable "${variableKey}" at "${path}" has token "${token}", which no longer matches the registered token "${definition.token}".`,
        { path },
      ),
    };
  }
  return { ok: true, definition };
}
