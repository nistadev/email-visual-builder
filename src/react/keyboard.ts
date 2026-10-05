// Keyboard tree operations (task 12.5): every structural drag/pointer
// operation has a keyboard equivalent dispatching the exact same commands.
// Used by both the canvas nodes and the layers tree so behavior stays
// identical across surfaces.
//
//   ArrowUp / ArrowDown        select previous/next node (DFS order)
//   Alt+ArrowUp / Alt+ArrowDown  move node within its parent
//   Ctrl/Cmd+D                 duplicate
//   Delete / Backspace         delete
//   Ctrl/Cmd+Z                 undo   (also on the workspace root)
//   Ctrl/Cmd+Shift+Z, Ctrl+Y   redo   (also on the workspace root)
//   Enter                      open/focus the inspector
//   Escape                     clear selection

import type { VisualDocument } from "../types/index.js";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { getDocumentTreeView, focusNodeElement } from "./node-helpers.js";
import type { NodeActions } from "./use-node-actions.js";

export interface TreeKeyContext {
  document: VisualDocument;
  nodeId: string;
  surface: "canvas" | "layers";
  nodeActions: NodeActions;
  select: (nodeId: string | null) => void;
  focusInspector: () => void;
}

function isUndo(event: ReactKeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  );
}

function isRedo(event: ReactKeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  return (
    ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "z") ||
    (event.ctrlKey && !event.shiftKey && key === "y")
  );
}

/** Undo/redo shortcuts handled at the workspace root so they work regardless of which pane has focus. Returns true when consumed. */
export function handleHistoryKeyDown(
  event: ReactKeyboardEvent,
  nodeActions: NodeActions,
): boolean {
  // Never steal undo/redo from text inputs or the rich-text surface — their own editing history owns it there.
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  ) {
    return false;
  }
  if (isUndo(event)) {
    event.preventDefault();
    nodeActions.undo();
    return true;
  }
  if (isRedo(event)) {
    event.preventDefault();
    nodeActions.redo();
    return true;
  }
  return false;
}

/** Keydown handler for a focused node element in the canvas or layers tree. Returns true when the event was consumed. */
export function handleTreeKeyDown(
  event: ReactKeyboardEvent,
  context: TreeKeyContext,
): boolean {
  const { document, nodeId, surface, nodeActions, select, focusInspector } =
    context;
  const isColumn = document.nodes[nodeId]?.type === "column";

  if (handleHistoryKeyDown(event, nodeActions)) return true;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    if (isColumn) return false;
    event.preventDefault();
    nodeActions.duplicate(nodeId, surface);
    return true;
  }

  switch (event.key) {
    case "ArrowUp":
    case "ArrowDown": {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (event.altKey) {
        nodeActions.moveWithinParent(nodeId, direction, surface);
        return true;
      }
      const { dfsOrder } = getDocumentTreeView(document);
      // Skip the invisible document root when traversing.
      const order = dfsOrder.filter((id) => id !== document.rootId);
      const currentIndex = order.indexOf(nodeId);
      const nextId = order[currentIndex + direction];
      if (currentIndex !== -1 && nextId !== undefined) {
        select(nextId);
        focusNodeElement(nextId, surface);
      }
      return true;
    }
    case "Delete":
    case "Backspace":
      if (isColumn) return false;
      event.preventDefault();
      nodeActions.removeNode(nodeId, surface);
      return true;
    case "Enter":
      event.preventDefault();
      select(nodeId);
      focusInspector();
      return true;
    case "Escape":
      event.preventDefault();
      select(null);
      return true;
    default:
      return false;
  }
}
