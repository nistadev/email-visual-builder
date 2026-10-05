// Recursive canvas rendering (task 12.3): block chrome (selection/hover
// outlines, action controls, drag handle), the isolated authored-content
// surface, empty-container affordances, drop slots, and non-destructive
// unsupported-plugin placeholders. Each `CanvasNode` subscribes only to its
// own node — command handlers keep untouched node references stable, so
// node-local edits never re-render unrelated canvas subtrees.

import type { VisualBuilderNode } from "../types/index.js";
import type { LexicalEditor } from "lexical";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Trash2,
} from "lucide-react";
import {
  memo,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { BlockContent, spacingToStyle } from "./canvas-block-content.js";
import { DropSlot, useBlockDragHandle } from "./dnd.js";
import { handleTreeKeyDown } from "./keyboard.js";
import { blockDisplayName } from "./labels.js";
import {
  useDocument,
  useHoveredNodeId,
  useNode,
  usePreviewDevice,
  useSelectedNodeId,
} from "./node-helpers.js";
import { useBuilderActions, useBuilderMeta } from "./provider.js";
import { VariableInsertControl } from "./rich-text/plugins/variable-insert-control.js";
import { useNodeActions } from "./use-node-actions.js";

const MOBILE_PREVIEW_WIDTH_PX = 375;
const TABLET_PREVIEW_WIDTH_PX = 768;

interface CursorPosition {
  x: number;
  y: number;
}

function CanvasHoverTooltip({
  cursor,
}: {
  cursor: CursorPosition | null;
}): React.JSX.Element | null {
  const hoveredNodeId = useHoveredNodeId();
  const hoveredNode = useNode(hoveredNodeId ?? "");
  const { labels } = useBuilderMeta();

  if (
    !hoveredNodeId ||
    !hoveredNode ||
    !cursor ||
    typeof document === "undefined"
  )
    return null;

  const offset = 14;
  const shouldOpenLeft = cursor.x > window.innerWidth - 280;
  const shouldOpenAbove = cursor.y > window.innerHeight - 56;
  const style: React.CSSProperties = {
    ...(shouldOpenLeft
      ? { right: Math.max(8, window.innerWidth - cursor.x + offset) }
      : { left: cursor.x + offset }),
    ...(shouldOpenAbove
      ? { bottom: Math.max(8, window.innerHeight - cursor.y + offset) }
      : { top: cursor.y + offset }),
  };

  return createPortal(
    <span
      className="donativus-vb-canvas-hover-tooltip bg-base-100 border-base-300"
      data-vb-canvas-hover-tooltip
      aria-hidden="true"
      style={style}
    >
      {blockDisplayName(labels, hoveredNode.type)}
    </span>,
    document.body,
  );
}

export function focusInspectorPanel(): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const inspector = document.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    const firstField = inspector?.querySelector<HTMLElement>(
      "input, select, textarea, button, [contenteditable]",
    );
    (firstField ?? inspector)?.focus();
  });
}

function NodeActionButtons({
  nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const nodeActions = useNodeActions();
  return (
    <span
      className="donativus-vb-node-actions join"
      role="toolbar"
      aria-label={labels.blockActionsLabel}
    >
      <button
        type="button"
        className="btn btn-xs join-item"
        aria-label={nodeType === "column" ? labels.moveLeft : labels.moveUp}
        onClick={() => nodeActions.moveWithinParent(nodeId, -1)}
      >
        {nodeType === "column" ? (
          <ArrowLeft size={14} aria-hidden="true" />
        ) : (
          <ArrowUp size={14} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="btn btn-xs join-item"
        aria-label={nodeType === "column" ? labels.moveRight : labels.moveDown}
        onClick={() => nodeActions.moveWithinParent(nodeId, 1)}
      >
        {nodeType === "column" ? (
          <ArrowRight size={14} aria-hidden="true" />
        ) : (
          <ArrowDown size={14} aria-hidden="true" />
        )}
      </button>
      {nodeType !== "column" ? (
        <>
          <button
            type="button"
            className="btn btn-xs join-item"
            aria-label={labels.duplicate}
            onClick={() => nodeActions.duplicate(nodeId)}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-xs join-item"
            aria-label={labels.remove}
            onClick={() => nodeActions.removeNode(nodeId)}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </span>
  );
}

function CanvasNodeChildren({
  node,
}: {
  node: VisualBuilderNode;
}): React.JSX.Element {
  const childIds = node.children ?? [];
  const { labels } = useBuilderMeta();
  const isColumns = node.type === "columns";
  const ratios = isColumns
    ? ((node.props as { columnWidthRatios?: number[] }).columnWidthRatios ?? [])
    : [];

  if (childIds.length === 0) {
    return (
      <div className="donativus-vb-empty-container">
        <DropSlot parentId={node.id} index={0} fill />
        <span className="donativus-vb-empty-hint">{labels.emptyContainer}</span>
      </div>
    );
  }

  return (
    <>
      {!isColumns && <DropSlot parentId={node.id} index={0} />}
      {childIds.map((childId, index) => {
        const child = <CanvasNode key={childId} nodeId={childId} />;
        const slot = !isColumns && (
          <DropSlot
            key={`slot-${index + 1}`}
            parentId={node.id}
            index={index + 1}
          />
        );
        if (isColumns) {
          return (
            <div
              key={childId}
              className="donativus-vb-canvas-column-slot"
              style={{ flex: `${ratios[index] ?? 1} 1 0` }}
            >
              {child}
            </div>
          );
        }
        return (
          <span key={childId} style={{ display: "contents" }}>
            {child}
            {slot}
          </span>
        );
      })}
    </>
  );
}

/**
 * Memoized so a document-wide re-render (e.g. `Canvas` reacting to a
 * settings change elsewhere) doesn't cascade into every node's own chrome —
 * only a node whose own `useNode(nodeId)` subscription actually fires
 * re-executes (design.md decision #5/#13; task 17.2). Keyboard navigation
 * needs the *whole* document/tree to walk siblings and ancestors, so it
 * reads the controller's current state on demand inside the handler instead
 * of subscribing to it — subscribing here would re-run every node's chrome
 * on every edit anywhere in the document, defeating the memoization.
 */
export const CanvasNode = memo(function CanvasNode({
  nodeId,
}: {
  nodeId: string;
}): React.JSX.Element | null {
  const node = useNode(nodeId);
  const selectedNodeId = useSelectedNodeId();
  const hoveredNodeId = useHoveredNodeId();
  const actions = useBuilderActions();
  const nodeActions = useNodeActions();
  const { registries, labels, variables, controller } = useBuilderMeta();

  const blockType = node?.type ?? "";
  const isColumn = blockType === "column";
  const dragHandle = useBlockDragHandle(nodeId, blockType, labels, isColumn);
  const richTextEditorRef = useRef<LexicalEditor | null>(null);
  const getRichTextEditor = useCallback(() => richTextEditorRef.current, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      handleTreeKeyDown(event, {
        document: controller.getState().document,
        nodeId,
        surface: "canvas",
        nodeActions,
        select: actions.select,
        focusInspector: focusInspectorPanel,
      });
    },
    [controller, nodeId, nodeActions, actions.select],
  );

  if (!node) return null;

  const definition = registries.blocks.get(node.type);
  const unavailable =
    definition === undefined ||
    (node as { unavailable?: boolean }).unavailable === true;
  const isSelected = selectedNodeId === nodeId;
  const isHovered = hoveredNodeId === nodeId;
  const displayName = blockDisplayName(labels, node.type);

  const chromeClass = [
    "donativus-vb-canvas-node",
    isSelected ? "is-selected" : "",
    isHovered && !isSelected ? "is-hovered" : "",
    dragHandle.isDragging ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={dragHandle.setNodeRef}
      data-vb-canvas-node={nodeId}
      className={chromeClass}
      role="group"
      aria-label={displayName}
      data-selected={isSelected || undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        event.stopPropagation();
        actions.select(nodeId);
      }}
      onMouseEnter={() => actions.hover(nodeId)}
      onMouseLeave={() => actions.hover(null)}
      onPointerDown={(event) => {
        if (isColumn) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "input, textarea, select, button, a, [contenteditable='true']",
          )
        )
          return;
        const handler = dragHandle.listeners?.onPointerDown;
        if (typeof handler === "function") handler(event);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) actions.select(nodeId);
      }}
    >
      {isSelected ? (
        <span className="donativus-vb-node-chrome-bar">
          <NodeActionButtons nodeId={nodeId} nodeType={node.type} />
        </span>
      ) : null}
      {isSelected &&
      (node.type === "heading" ||
        node.type === "rich-text" ||
        node.type === "cta") ? (
        <VariableInsertControl
          variables={variables}
          label={labels.addVariable}
          searchPlaceholder={labels.searchVariables}
          noMatchesLabel={labels.noVariableMatches}
          getEditor={getRichTextEditor}
        />
      ) : null}
      {unavailable ? (
        <div className="donativus-vb-unsupported-block" role="note">
          {labels.unsupportedBlock(node.type)}
        </div>
      ) : (
        <BlockContent node={node} editorRef={richTextEditorRef}>
          {definition?.isContainer ? (
            <CanvasNodeChildren node={node} />
          ) : undefined}
        </BlockContent>
      )}
    </div>
  );
});

/**
 * The canvas pane mirrors the exported body + main/table hierarchy: the full
 * work surface owns the document background, while the rendered sections
 * square owns the configured max-width/alignment and natural content height.
 */
export function Canvas(): React.JSX.Element {
  const document = useDocument();
  const previewDevice = usePreviewDevice();
  const actions = useBuilderActions();
  const { labels } = useBuilderMeta();
  const [cursor, setCursor] = useState<CursorPosition | null>(null);

  const updateCursor = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    setCursor({ x: event.clientX, y: event.clientY });
  }, []);

  const settings = document.settings;
  const linkStyleVariables = {
    "--donativus-vb-link-color": settings.linkStyle.color,
    "--donativus-vb-link-text-decoration": settings.linkStyle.underline
      ? "underline"
      : "none",
  } as React.CSSProperties;
  const previewViewportStyle: React.CSSProperties =
    previewDevice === "mobile"
      ? { width: `${MOBILE_PREVIEW_WIDTH_PX}px`, maxWidth: "100%" }
      : previewDevice === "tablet"
        ? { width: `${TABLET_PREVIEW_WIDTH_PX}px`, maxWidth: "100%" }
        : { width: "100%", maxWidth: "100%" };
  const sectionsCanvasStyle: React.CSSProperties = {
    ...spacingToStyle(settings.spacing),
    ...linkStyleVariables,
    boxSizing: "border-box",
    width: "100%",
    maxWidth:
      settings.contentWidth.unit === "px"
        ? `${settings.contentWidth.value}px`
        : `${settings.contentWidth.value}%`,
  };
  const pageBackground =
    document.mode === "email"
      ? document.settings.canvasBackgroundColor
      : document.settings.pageBackgroundColor;

  const root = document.nodes[document.rootId];
  const rootChildIds = root?.children ?? [];

  return (
    <section
      className="donativus-vb-canvas donativus-vb-authored"
      aria-label={labels.canvasLabel}
      data-vb-preview-device={previewDevice}
      style={{
        backgroundColor: pageBackground,
      }}
      onClick={() => actions.select(null)}
      onPointerMove={updateCursor}
      onPointerLeave={() => setCursor(null)}
    >
      <CanvasHoverTooltip cursor={cursor} />
      <div
        className="donativus-vb-page"
        data-vb-preview-viewport
        style={{
          ...previewViewportStyle,
          justifyContent:
            settings.contentAlign === "left"
              ? "flex-start"
              : settings.contentAlign === "right"
                ? "flex-end"
                : "center",
        }}
      >
        <div
          className="donativus-vb-sections-canvas"
          data-vb-sections-canvas
          style={sectionsCanvasStyle}
        >
          {rootChildIds.length === 0 ? (
            <div className="donativus-vb-empty-container">
              <DropSlot parentId={document.rootId} index={0} fill />
              <span className="donativus-vb-empty-hint">
                {labels.emptyContainer}
              </span>
            </div>
          ) : (
            <>
              <DropSlot parentId={document.rootId} index={0} />
              {rootChildIds.map((childId, index) => (
                <span key={childId} style={{ display: "contents" }}>
                  <CanvasNode nodeId={childId} />
                  <DropSlot parentId={document.rootId} index={index + 1} />
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
