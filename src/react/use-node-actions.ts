// One shared implementation of insert/select/move/duplicate/delete/undo/redo
// so pointer (canvas buttons, dnd), keyboard, and layers surfaces stay
// command-equivalent (task 12.5, spec "keyboard user reorders a block").
// Every operation announces its outcome on the provider live region and
// restores focus to a predictable element after React commits.

import { useMemo } from "react";
import {
  getDocumentTreeView,
  focusNodeElement,
  resolveInsertTarget,
} from "./node-helpers.js";
import { blockDisplayName } from "./labels.js";
import { useBuilderActions, useBuilderMeta } from "./provider.js";

export interface NodeActions {
  insertBlock: (
    blockType: string,
    target?: { parentId: string; index: number },
  ) => void;
  moveWithinParent: (
    nodeId: string,
    direction: -1 | 1,
    surface?: "canvas" | "layers",
  ) => void;
  moveTo: (nodeId: string, newParentId: string, index: number) => boolean;
  duplicate: (nodeId: string, surface?: "canvas" | "layers") => void;
  removeNode: (nodeId: string, surface?: "canvas" | "layers") => void;
  undo: () => void;
  redo: () => void;
}

export function useNodeActions(): NodeActions {
  const actions = useBuilderActions();
  const { controller, registries, labels } = useBuilderMeta();

  return useMemo<NodeActions>(() => {
    const nameOf = (nodeId: string): string => {
      const node = controller.getState().document.nodes[nodeId];
      return node ? blockDisplayName(labels, node.type) : nodeId;
    };

    const announceFailure = (issues: { message: string }[]): void => {
      const message = issues[0]?.message ?? "unknown error";
      actions.announce(labels.announceCommandRejected(message));
    };

    return {
      insertBlock: (blockType, target) => {
        const { document } = controller.getState();
        const resolved =
          target ??
          resolveInsertTarget(
            document,
            registries,
            blockType,
            controller.getState().transient.selectedNodeId,
          );
        if (!resolved) {
          actions.announce(
            labels.announceCommandRejected(labels.dropNotAllowed),
          );
          return;
        }
        const result = actions.dispatch({
          type: "insert-node",
          parentId: resolved.parentId,
          blockType,
          index: resolved.index,
        });
        if (!result.ok) {
          announceFailure(result.issues);
          return;
        }
        actions.announce(
          labels.announceInserted(blockDisplayName(labels, blockType)),
        );
        if (result.selectedNodeId) focusNodeElement(result.selectedNodeId);
      },

      moveWithinParent: (nodeId, direction, surface = "canvas") => {
        const { document } = controller.getState();
        const { parentOf } = getDocumentTreeView(document);
        const parentId = parentOf.get(nodeId);
        if (parentId === null || parentId === undefined) return;
        const siblings = document.nodes[parentId]?.children ?? [];
        const currentIndex = siblings.indexOf(nodeId);
        const nextIndex = currentIndex + direction;
        if (
          currentIndex === -1 ||
          nextIndex < 0 ||
          nextIndex >= siblings.length
        )
          return;
        const result = actions.dispatch({
          type: "move-node",
          nodeId,
          newParentId: parentId,
          index: nextIndex,
        });
        if (!result.ok) {
          announceFailure(result.issues);
          return;
        }
        actions.announce(
          labels.announceMoved(nameOf(nodeId), nextIndex + 1, siblings.length),
        );
        focusNodeElement(nodeId, surface);
      },

      moveTo: (nodeId, newParentId, index) => {
        const result = actions.dispatch({
          type: "move-node",
          nodeId,
          newParentId,
          index,
        });
        if (!result.ok) {
          announceFailure(result.issues);
          return false;
        }
        const total =
          controller.getState().document.nodes[newParentId]?.children?.length ??
          index + 1;
        actions.announce(
          labels.announceMoved(nameOf(nodeId), index + 1, total),
        );
        focusNodeElement(nodeId);
        return true;
      },

      duplicate: (nodeId, surface = "canvas") => {
        const blockName = nameOf(nodeId);
        const result = actions.dispatch({ type: "duplicate-node", nodeId });
        if (!result.ok) {
          announceFailure(result.issues);
          return;
        }
        actions.announce(labels.announceDuplicated(blockName));
        if (result.selectedNodeId)
          focusNodeElement(result.selectedNodeId, surface);
      },

      removeNode: (nodeId, surface = "canvas") => {
        const { document } = controller.getState();
        const blockName = nameOf(nodeId);
        const parentId = getDocumentTreeView(document).parentOf.get(nodeId);
        const result = actions.dispatch({ type: "remove-node", nodeId });
        if (!result.ok) {
          announceFailure(result.issues);
          return;
        }
        actions.announce(labels.announceRemoved(blockName));
        if (parentId !== null && parentId !== undefined) {
          actions.select(parentId);
          focusNodeElement(parentId, surface);
        }
      },

      undo: () => {
        if (actions.undo()) actions.announce(labels.announceUndo);
      },
      redo: () => {
        if (actions.redo()) actions.announce(labels.announceRedo);
      },
    };
  }, [actions, controller, registries, labels]);
}
