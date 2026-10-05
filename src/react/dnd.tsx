// dnd-kit wiring (task 12.4). Two drag sources — existing canvas nodes (via
// their drag handles) and library items (inserting a new block) — and one
// droppable kind: an insertion slot identified by `(parentId, index)` over
// the pre-drop children array. A completed drag dispatches exactly one
// command (`move-node` or `insert-node`), so a single undo reverts it.
// Autoscroll is dnd-kit's built-in default. Allowed-target feedback comes
// from the same registry legality check the command handlers enforce.

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useState, type ReactNode } from "react";
import type { VisualDocument } from "../types/index.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { blockDisplayName, type BuilderLabels } from "./labels.js";
import {
  canPlaceBlock,
  getDocumentTreeView,
  isDescendantOf,
} from "./node-helpers.js";
import { useBuilderMeta } from "./provider.js";
import { useNodeActions, type NodeActions } from "./use-node-actions.js";

export type ActiveDragData =
  | { source: "node"; nodeId: string; blockType: string }
  | { source: "library"; blockType: string };

export interface DropSlotData {
  parentId: string;
  index: number;
}

function isActiveDragData(value: unknown): value is ActiveDragData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    (data.source === "node" || data.source === "library") &&
    typeof data.blockType === "string"
  );
}

function isDropSlotData(value: unknown): value is DropSlotData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return typeof data.parentId === "string" && typeof data.index === "number";
}

/** Whether the active drag payload may legally land in `slot` — registry rules plus cycle prevention for node moves. */
export function isDropAllowed(
  document: VisualDocument,
  registries: BuilderRegistries,
  drag: ActiveDragData,
  slot: DropSlotData,
): boolean {
  if (!canPlaceBlock(document, registries, drag.blockType, slot.parentId))
    return false;
  if (drag.source === "node") {
    if (slot.parentId === drag.nodeId) return false;
    if (isDescendantOf(document, slot.parentId, drag.nodeId)) return false;
  }
  return true;
}

/**
 * Resolves a completed drag into the single command to dispatch, or `null`
 * for a no-op (dropped outside, onto itself, or onto a denied target).
 * Exported separately so tests can drive drag completion without simulating
 * pointer events.
 */
export function completeDrag(
  document: VisualDocument,
  registries: BuilderRegistries,
  nodeActions: NodeActions,
  drag: ActiveDragData,
  slot: DropSlotData | null,
): boolean {
  if (!slot || !isDropAllowed(document, registries, drag, slot)) return false;

  if (drag.source === "library") {
    nodeActions.insertBlock(drag.blockType, {
      parentId: slot.parentId,
      index: slot.index,
    });
    return true;
  }

  const { parentOf } = getDocumentTreeView(document);
  const currentParentId = parentOf.get(drag.nodeId);
  let targetIndex = slot.index;
  if (currentParentId === slot.parentId) {
    const siblings = document.nodes[slot.parentId]?.children ?? [];
    const sourceIndex = siblings.indexOf(drag.nodeId);
    // Slot indexes address the pre-removal children array; adjacent slots are a no-op.
    if (sourceIndex === slot.index || sourceIndex + 1 === slot.index)
      return false;
    if (sourceIndex !== -1 && sourceIndex < slot.index)
      targetIndex = slot.index - 1;
  }
  return nodeActions.moveTo(drag.nodeId, slot.parentId, targetIndex);
}

/** Prefer the slot directly under the pointer; fall back to rectangle intersection (keyboard sensor has no pointer). */
const collisionDetection: CollisionDetection = (args) => {
  const withPointer = pointerWithin(args);
  return withPointer.length > 0 ? withPointer : rectIntersection(args);
};

export function BuilderDndContext({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const { controller, registries, labels } = useBuilderMeta();
  const nodeActions = useNodeActions();
  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    setActiveDrag(isActiveDragData(data) ? data : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const drag = event.active.data.current;
      if (!isActiveDragData(drag)) return;
      const slotData = event.over?.data.current;
      const slot = isDropSlotData(slotData) ? slotData : null;
      completeDrag(
        controller.getState().document,
        registries,
        nodeActions,
        drag,
        slot,
      );
    },
    [controller, registries, nodeActions],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
      accessibility={{
        container: typeof document === "undefined" ? undefined : document.body,
      }}
    >
      {children as never}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <span className="donativus-vb-drag-overlay badge badge-primary badge-lg">
            {blockDisplayName(labels, activeDrag.blockType)}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export interface UseBlockDragHandleResult {
  setNodeRef: (element: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
}

/** Drag source for an existing canvas node. */
export function useBlockDragHandle(
  nodeId: string,
  blockType: string,
  labels: BuilderLabels,
  disabled = false,
): UseBlockDragHandleResult {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `node:${nodeId}`,
    data: { source: "node", nodeId, blockType } satisfies ActiveDragData,
    disabled,
  });
  return {
    setNodeRef,
    attributes: {
      ...attributes,
      "aria-label": labels.dragHandle(blockDisplayName(labels, blockType)),
    },
    listeners: listeners as Record<string, unknown> | undefined,
    isDragging,
  };
}

/** Drag source for a library item (inserts a new block on drop). */
export function useLibraryDrag(blockType: string): UseBlockDragHandleResult {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `library:${blockType}`,
    data: { source: "library", blockType } satisfies ActiveDragData,
  });
  return {
    setNodeRef,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: listeners as Record<string, unknown> | undefined,
    isDragging,
  };
}

export interface DropSlotProps {
  parentId: string;
  index: number;
  /** Fills the whole empty container instead of rendering as a thin bar between children. */
  fill?: boolean;
}

/** An insertion slot. Only visible while a drag is active; styled as allowed or denied for the active payload. */
export function DropSlot({
  parentId,
  index,
  fill = false,
}: DropSlotProps): React.JSX.Element {
  const { controller, registries } = useBuilderMeta();
  const { active } = useDndContext();
  const dragData = active?.data.current;
  const drag = isActiveDragData(dragData) ? dragData : null;
  const allowed = drag
    ? isDropAllowed(controller.getState().document, registries, drag, {
        parentId,
        index,
      })
    : false;

  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${parentId}:${index}${fill ? ":fill" : ""}`,
    data: { parentId, index } satisfies DropSlotData,
    disabled: drag !== null && !allowed,
  });

  const stateClass =
    drag === null ? " is-idle" : allowed ? " is-active" : " is-denied";
  return (
    <div
      ref={setNodeRef}
      data-vb-drop-slot={`${parentId}:${index}`}
      data-vb-drop-slot-visible={drag !== null || undefined}
      className={`donativus-vb-drop-slot${fill ? " is-fill" : ""}${stateClass}${isOver && allowed ? " is-over" : ""}`}
      aria-hidden="true"
    />
  );
}
