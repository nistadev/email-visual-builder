import type { VisualBuilderNodeRecord } from "../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { err, issue, ok, type ParseResult } from "./result.js";

export interface VisualDocumentTreeIndex {
  rootId: string;
  /** Derived parent lookup — never persisted, always computed from `children`. */
  parentOf: Record<string, string | null>;
  reachableNodeIds: Set<string>;
}

/**
 * Validates root existence, unique ownership (no node claimed as a child by
 * more than one parent), duplicate children, cycles, and orphan nodes, then
 * derives the parent lookup for every node reachable from root. See
 * design.md decision #2 — parent pointers are always derived, never stored.
 */
export function buildTreeIndex(
  rootId: string,
  nodes: VisualBuilderNodeRecord,
): ParseResult<VisualDocumentTreeIndex> {
  if (!(rootId in nodes)) {
    return err([
      issue(
        "document/missing-root",
        `Root node "${rootId}" is not present in "nodes".`,
      ),
    ]);
  }

  const owner: Record<string, string> = {};
  const issues = [];

  for (const [nodeId, node] of Object.entries(nodes)) {
    const children = node.children;
    if (!children) continue;
    const seenInThisNode = new Set<string>();
    for (const childId of children) {
      if (seenInThisNode.has(childId)) {
        issues.push(
          issue(
            "document/duplicate-child",
            `Node "${nodeId}" lists child "${childId}" more than once.`,
            {
              nodeId,
            },
          ),
        );
        continue;
      }
      seenInThisNode.add(childId);

      if (childId === nodeId) {
        issues.push(
          issue(
            "document/self-referential-node",
            `Node "${nodeId}" lists itself as a child.`,
            { nodeId },
          ),
        );
        continue;
      }
      if (!(childId in nodes)) {
        issues.push(
          issue(
            "document/missing-child-reference",
            `Node "${nodeId}" references missing node "${childId}".`,
            {
              nodeId,
            },
          ),
        );
        continue;
      }
      if (owner[childId] !== undefined) {
        issues.push(
          issue(
            "document/duplicate-ownership",
            `Node "${childId}" is claimed as a child by both "${owner[childId]}" and "${nodeId}".`,
            { nodeId: childId },
          ),
        );
        continue;
      }
      owner[childId] = nodeId;
    }
  }
  if (issues.length > 0) return err(issues);

  if (rootId in owner) {
    return err([
      issue(
        "document/root-has-parent",
        `Root node "${rootId}" cannot be another node's child.`,
      ),
    ]);
  }

  const parentOf: Record<string, string | null> = { [rootId]: null };
  const reachableNodeIds = new Set<string>([rootId]);
  const queue: { nodeId: string; depth: number }[] = [
    { nodeId: rootId, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.depth > VISUAL_DOCUMENT_LIMITS.maxDepth) {
      return err([
        issue(
          "document/tree-too-deep",
          `Node tree exceeds the maximum depth at "${current.nodeId}".`,
          {
            nodeId: current.nodeId,
          },
        ),
      ]);
    }
    const node = nodes[current.nodeId];
    for (const childId of node?.children ?? []) {
      parentOf[childId] = current.nodeId;
      reachableNodeIds.add(childId);
      queue.push({ nodeId: childId, depth: current.depth + 1 });
    }
  }

  const unreachableIssues = [];
  for (const nodeId of Object.keys(nodes)) {
    if (reachableNodeIds.has(nodeId)) continue;
    const kind = classifyUnreachableNode(nodeId, owner);
    unreachableIssues.push(
      kind === "cycle"
        ? issue(
            "document/cycle",
            `Node "${nodeId}" is part of a parent/child cycle unreachable from root.`,
            {
              nodeId,
            },
          )
        : issue(
            "document/orphan-node",
            `Node "${nodeId}" is not reachable from root "${rootId}".`,
            { nodeId },
          ),
    );
  }
  if (unreachableIssues.length > 0) return err(unreachableIssues);

  return ok({ rootId, parentOf, reachableNodeIds });
}

function classifyUnreachableNode(
  nodeId: string,
  owner: Record<string, string>,
): "cycle" | "orphan" {
  const seen = new Set<string>();
  let current: string | undefined = nodeId;
  while (current !== undefined) {
    if (seen.has(current)) return "cycle";
    seen.add(current);
    current = owner[current];
  }
  return "orphan";
}
