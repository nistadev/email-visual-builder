import type {
  VisualDocument,
  VisualDocumentQualityWarning,
} from "../types/index.js";
import type { BuilderRegistries } from "./registry/types.js";

/**
 * Runs each available block's registered `qualityChecks` (design.md decision
 * #4) over its own nodes. Unavailable-plugin nodes are skipped — there is no
 * definition to run checks with, and `collectUnavailableNodeIssues` already
 * reports them as a blocking error.
 */
export function collectBlockDefinedQualityWarnings(
  document: VisualDocument,
  registries: BuilderRegistries,
): VisualDocumentQualityWarning[] {
  const warnings: VisualDocumentQualityWarning[] = [];
  for (const node of Object.values(document.nodes)) {
    if ("unavailable" in node) continue;
    const definition = registries.blocks.get(node.type);
    if (!definition?.qualityChecks) continue;
    for (const check of definition.qualityChecks) {
      warnings.push(...check(node));
    }
  }
  return warnings;
}
