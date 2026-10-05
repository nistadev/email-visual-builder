// Derived per-document tree helpers for the editor chrome: parent lookup,
// DFS order for keyboard traversal, drop-target legality, and node hooks.
// Everything is memoized per document identity (WeakMap) — command handlers
// replace the document object on every committed change, so a cached index
// can never go stale.

import type { VisualBuilderNode, VisualDocument } from "../types/index.js";
import { useCallback } from "react";
import type { BuilderState } from "../core/controller/state-types.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { useBuilderMeta, useBuilderSelector } from "./provider.js";

export interface DocumentTreeView {
  /** Derived parent lookup for every reachable node. */
  parentOf: ReadonlyMap<string, string | null>;
  /** Depth-first pre-order of reachable node IDs, root first. */
  dfsOrder: readonly string[];
  depthOf: ReadonlyMap<string, number>;
}

const treeViewCache = new WeakMap<VisualDocument, DocumentTreeView>();

export function getDocumentTreeView(
  document: VisualDocument,
): DocumentTreeView {
  const cached = treeViewCache.get(document);
  if (cached) return cached;

  const parentOf = new Map<string, string | null>([[document.rootId, null]]);
  const depthOf = new Map<string, number>([[document.rootId, 0]]);
  const dfsOrder: string[] = [];
  const stack: string[] = [document.rootId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (nodeId === undefined || visited.has(nodeId)) continue;
    visited.add(nodeId);
    dfsOrder.push(nodeId);
    const node = document.nodes[nodeId];
    const children = node?.children ?? [];
    const depth = depthOf.get(nodeId) ?? 0;
    // Push in reverse so pre-order pops children first-to-last.
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const childId = children[index];
      if (
        childId === undefined ||
        !(childId in document.nodes) ||
        visited.has(childId)
      )
        continue;
      parentOf.set(childId, nodeId);
      depthOf.set(childId, depth + 1);
      stack.push(childId);
    }
  }

  const view: DocumentTreeView = { parentOf, dfsOrder, depthOf };
  treeViewCache.set(document, view);
  return view;
}

export function isDescendantOf(
  document: VisualDocument,
  nodeId: string,
  ancestorId: string,
): boolean {
  const { parentOf } = getDocumentTreeView(document);
  let current: string | null | undefined = nodeId;
  while (current !== null && current !== undefined) {
    if (current === ancestorId) return true;
    current = parentOf.get(current);
  }
  return false;
}

/** Registry legality of placing a `childType` block under `parentId` — mirrors the command handler's constraint checks for pre-drop feedback. */
export function canPlaceBlock(
  document: VisualDocument,
  registries: BuilderRegistries,
  childType: string,
  parentId: string,
): boolean {
  const parent = document.nodes[parentId];
  if (!parent) return false;
  const parentDefinition = registries.blocks.get(parent.type);
  const childDefinition = registries.blocks.get(childType);
  if (!parentDefinition || !childDefinition) return false;
  if (!parentDefinition.isContainer) return false;
  if (!childDefinition.supportedModes.includes(document.mode)) return false;
  if (
    parentDefinition.allowedChildTypes &&
    !parentDefinition.allowedChildTypes.includes(childType)
  )
    return false;
  if (
    childDefinition.allowedParentTypes &&
    !childDefinition.allowedParentTypes.includes(parent.type)
  )
    return false;
  return true;
}

export function useNode(nodeId: string): VisualBuilderNode | undefined {
  const selector = useCallback(
    (state: BuilderState) => state.document.nodes[nodeId],
    [nodeId],
  );
  return useBuilderSelector(selector);
}

/**
 * A node's depth, scoped so a subscriber only re-renders when *its own*
 * depth changes (e.g. it was moved to a different level) rather than on
 * every document edit — `getDocumentTreeView` recomputes per new document
 * identity but is itself cached, so this stays cheap for large trees.
 */
export function useNodeDepth(nodeId: string): number {
  const selector = useCallback(
    (state: BuilderState) =>
      getDocumentTreeView(state.document).depthOf.get(nodeId) ?? 0,
    [nodeId],
  );
  return useBuilderSelector(selector);
}

export function useSelectedNodeId(): string | null {
  return useBuilderSelector(
    (state: BuilderState) => state.transient.selectedNodeId,
  );
}

export function useHoveredNodeId(): string | null {
  return useBuilderSelector(
    (state: BuilderState) => state.transient.hoveredNodeId,
  );
}

export function usePreviewDevice(): "desktop" | "tablet" | "mobile" {
  return useBuilderSelector(
    (state: BuilderState) => state.transient.previewDevice,
  );
}

export function useDocument(): VisualDocument {
  return useBuilderSelector((state: BuilderState) => state.document);
}

/** The container to insert into for a toolbar/library insert action: the selected container, the selected node's parent, or the last root section. */
export function resolveInsertTarget(
  document: VisualDocument,
  registries: BuilderRegistries,
  blockType: string,
  selectedNodeId: string | null,
): { parentId: string; index: number } | null {
  const { parentOf } = getDocumentTreeView(document);

  // Layout blocks such as `columns` contain internal containers. When the
  // layout itself is selected, clicking a content block should place it in
  // the first compatible column instead of unexpectedly appending it after
  // the whole layout in the surrounding section.
  if (selectedNodeId) {
    const descendants = [...(document.nodes[selectedNodeId]?.children ?? [])];
    for (let index = 0; index < descendants.length; index += 1) {
      const descendantId = descendants[index];
      if (descendantId === undefined) continue;
      if (canPlaceBlock(document, registries, blockType, descendantId)) {
        const children = document.nodes[descendantId]?.children ?? [];
        return { parentId: descendantId, index: children.length };
      }
      descendants.push(...(document.nodes[descendantId]?.children ?? []));
    }
  }

  let candidateId: string | null | undefined = selectedNodeId ?? undefined;
  while (candidateId !== null && candidateId !== undefined) {
    if (canPlaceBlock(document, registries, blockType, candidateId)) {
      const children = document.nodes[candidateId]?.children ?? [];
      // Insert after the previously selected child when we walked up from one.
      return { parentId: candidateId, index: children.length };
    }
    candidateId = parentOf.get(candidateId);
  }
  if (canPlaceBlock(document, registries, blockType, document.rootId)) {
    const rootChildren = document.nodes[document.rootId]?.children ?? [];
    return { parentId: document.rootId, index: rootChildren.length };
  }
  // Fall back to the last root section for content blocks.
  const rootChildren = document.nodes[document.rootId]?.children ?? [];
  for (let index = rootChildren.length - 1; index >= 0; index -= 1) {
    const sectionId = rootChildren[index];
    if (
      sectionId !== undefined &&
      canPlaceBlock(document, registries, blockType, sectionId)
    ) {
      const sectionChildren = document.nodes[sectionId]?.children ?? [];
      return { parentId: sectionId, index: sectionChildren.length };
    }
  }
  return null;
}

/** Moves DOM focus to a canvas or layer element for `nodeId` after React commits — used for post-command focus restoration. */
export function focusNodeElement(
  nodeId: string,
  surface: "canvas" | "layers" = "canvas",
): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const escapedId = nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const element = globalThis.document.querySelector<HTMLElement>(
      `[data-vb-${surface}-node="${escapedId}"]`,
    );
    element?.focus();
  });
}

/** Convenience wrapper joining meta + document for components that need placement checks. */
export function useCanPlaceBlock(): (
  childType: string,
  parentId: string,
) => boolean {
  const { registries } = useBuilderMeta();
  const document = useDocument();
  return useCallback(
    (childType: string, parentId: string) =>
      canPlaceBlock(document, registries, childType, parentId),
    [document, registries],
  );
}
