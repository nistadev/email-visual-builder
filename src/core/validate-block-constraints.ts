import type {
  VisualDocument,
  VisualDocumentValidationIssue,
} from "../types/index.js";
import type { BuilderRegistries } from "./registry/types.js";
import { issue } from "./result.js";
import { buildTreeIndex } from "./tree.js";

/**
 * Checks every node's actual parent/child relationship against its block
 * definition's `allowedParentTypes`/`allowedChildTypes`/`isContainer`
 * (design.md decision #6 — no nested sections, columns own only `column`,
 * etc.), plus that the document root is occupied by a root-only block type.
 * The controller's insert/move commands already enforce this preventively;
 * this is the detective counterpart for documents that reached this shape
 * some other way (e.g. a hand-restored JSON payload). Nodes whose type is
 * absent from the registry (unavailable plugin nodes) are skipped here —
 * `collectUnavailableNodeIssues` already reports them.
 */
export function validateBlockConstraints(
  document: VisualDocument,
  registries: BuilderRegistries,
): VisualDocumentValidationIssue[] {
  const issues: VisualDocumentValidationIssue[] = [];

  const rootNode = document.nodes[document.rootId];
  if (rootNode && !("unavailable" in rootNode && rootNode.unavailable)) {
    const rootDefinition = registries.blocks.get(rootNode.type);
    if (!rootDefinition) {
      issues.push(
        issue(
          "document/unknown-root-block-type",
          `Root node type "${rootNode.type}" is not registered.`,
          {
            nodeId: document.rootId,
          },
        ),
      );
    } else if (rootDefinition.allowedParentTypes !== null) {
      issues.push(
        issue(
          "document/invalid-root-block-type",
          `Root node has type "${rootNode.type}", which is not a root-only block type.`,
          { nodeId: document.rootId },
        ),
      );
    }
  }

  const treeResult = buildTreeIndex(document.rootId, document.nodes);
  if (!treeResult.ok) return [...issues, ...treeResult.issues];

  for (const [nodeId, parentId] of Object.entries(treeResult.value.parentOf)) {
    if (parentId === null) continue; // root itself, already checked above
    const node = document.nodes[nodeId];
    const parent = document.nodes[parentId];
    if (!node || !parent) continue;
    if (
      ("unavailable" in node && node.unavailable) ||
      ("unavailable" in parent && parent.unavailable)
    )
      continue;

    const nodeDefinition = registries.blocks.get(node.type);
    const parentDefinition = registries.blocks.get(parent.type);
    if (!nodeDefinition || !parentDefinition) continue;

    if (!parentDefinition.isContainer) {
      issues.push(
        issue(
          "document/invalid-parent",
          `Node "${parentId}" cannot contain children.`,
          { nodeId: parentId },
        ),
      );
      continue;
    }
    if (
      parentDefinition.allowedChildTypes &&
      !parentDefinition.allowedChildTypes.includes(node.type)
    ) {
      issues.push(
        issue(
          "document/disallowed-child-type",
          `"${parent.type}" does not allow a "${node.type}" child.`,
          { nodeId },
        ),
      );
    }
    if (
      nodeDefinition.allowedParentTypes &&
      !nodeDefinition.allowedParentTypes.includes(parent.type)
    ) {
      issues.push(
        issue(
          "document/disallowed-parent-type",
          `Block type "${node.type}" cannot be placed inside a "${parent.type}".`,
          { nodeId },
        ),
      );
    }
  }

  return issues;
}
