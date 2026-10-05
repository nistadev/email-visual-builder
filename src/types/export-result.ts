// The result contract for the parse-migrate-validate-check-serialize-render
// pipeline. See design.md decision #10 — identical document+registry input
// MUST produce byte-identical `json`/`html` output.

import type { VisualDocument } from "./document.js";
import type {
  VisualDocumentQualityWarning,
  VisualDocumentValidationIssue,
} from "./validation.js";

export interface VisualDocumentExportResult {
  /** The parsed, migrated document, or `null` if parsing failed before a document could be produced. */
  document: VisualDocument | null;
  /** Deterministic canonical JSON, present whenever `document` is non-null. */
  json: string | null;
  /** Present only when `errors` is empty. */
  html: string | null;
  errors: VisualDocumentValidationIssue[];
  warnings: VisualDocumentQualityWarning[];
}
