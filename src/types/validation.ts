import type { VisualBuilderNodeId } from "./document-node.js";

interface VisualDocumentIssueLocation {
  /** The affected node, when the issue is node-scoped. */
  nodeId?: VisualBuilderNodeId;
  /** e.g. `"props.destination"` or `"settings.language"`. */
  path?: string;
}

/** A blocking problem — export/save MUST be refused while any exist. */
export interface VisualDocumentValidationIssue extends VisualDocumentIssueLocation {
  code: string;
  message: string;
}

/** A non-blocking issue — HTML/JSON export still succeeds. */
export interface VisualDocumentQualityWarning extends VisualDocumentIssueLocation {
  code: string;
  message: string;
}
