// Context-aware validation for a parsed `TemplatedValue` (design.md
// decision #8, task 7.5). Structural parsing (section 3) already guarantees
// segment shape; this checks that every variable segment resolves and is
// allowed in `usage`, that literal segments carry no unresolved
// variable-like text, and — for a fully-literal URL/image-url value — that
// the concatenated string is itself a safe URL (decision #8: "Static
// literal URLs are normalized and checked against the allowed protocols").
// A value that mixes literal text with a variable segment skips the
// full-URL check because the substituted value is not known until send
// time; the variable segment's own allowed-context check is what protects
// that case.

import type {
  TemplatedValue,
  VariableRenderContext,
  VisualDocumentValidationIssue,
} from "../../types/index.js";
import { issue } from "../result.js";
import type { VariableRegistry } from "../registry/types.js";
import { validateSafeUrl, type UrlValidationOptions } from "../url.js";
import { resolveVariableReference } from "./resolve.js";
import { checkLiteralTextForUnresolvedVariables } from "./unresolved-text.js";

export function validateTemplatedValue(
  value: TemplatedValue,
  usage: VariableRenderContext,
  registry: VariableRegistry,
  path: string,
  urlOptions: UrlValidationOptions = {},
): VisualDocumentValidationIssue[] {
  const issues: VisualDocumentValidationIssue[] = [];
  let hasVariableSegment = false;

  value.segments.forEach((segment, index) => {
    const segmentPath = `${path}.segments[${index}]`;
    if (segment.kind === "variable") {
      hasVariableSegment = true;
      const resolution = resolveVariableReference(
        segment.variableKey,
        segment.token,
        registry,
        segmentPath,
      );
      if (!resolution.ok) {
        issues.push(resolution.issue);
        return;
      }
      if (!resolution.definition.allowedContexts.includes(usage)) {
        issues.push(
          issue(
            "value/variable-context-not-allowed",
            `Variable "${segment.variableKey}" at "${segmentPath}" is not allowed in a "${usage}" context.`,
            { path: segmentPath },
          ),
        );
      }
      return;
    }
    issues.push(
      ...checkLiteralTextForUnresolvedVariables(
        segment.value,
        registry,
        segmentPath,
      ),
    );
  });

  if ((usage === "url" || usage === "image-url") && !hasVariableSegment) {
    const literal = value.segments
      .map((segment) => (segment.kind === "literal" ? segment.value : ""))
      .join("");
    // An empty destination is a quality warning (`collectLinkQualityWarnings`), not a blocking
    // URL-format error — there is no scheme to reject yet.
    if (literal.trim().length > 0) {
      const urlResult = validateSafeUrl(literal, path, urlOptions);
      if (!urlResult.ok) issues.push(...urlResult.issues);
    }
  }

  return issues;
}
