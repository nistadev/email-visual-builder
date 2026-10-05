import type {
  VisualDocument,
  VisualDocumentValidationIssue,
} from "../types/index.js";
import { issue } from "./result.js";

/**
 * A syntactically valid but unavailable-plugin node is preserved by the
 * parser (never discarded) and rendered as a canvas placeholder, but strict
 * export must still block on it and identify the node (design.md decision
 * #4). This is invoked by the section-8 export pipeline as one of its
 * blocking-error sources — parsing itself never fails because of an
 * unavailable node.
 */
export function collectUnavailableNodeIssues(
  document: VisualDocument,
): VisualDocumentValidationIssue[] {
  const issues: VisualDocumentValidationIssue[] = [];
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    if ("unavailable" in node && node.unavailable) {
      issues.push(
        issue(
          "document/unsupported-block",
          `Node "${nodeId}" has type "${node.type}", which is not present in the active block registry.`,
          { nodeId },
        ),
      );
    }
  }
  return issues;
}
