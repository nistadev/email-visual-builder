// The Layers tree (task 12.7): searchable hierarchy with expansion,
// selected-node synchronization (tree selection follows canvas selection and
// vice versa), and accessible per-item reorder/duplicate/delete actions.
// Uses the same `handleTreeKeyDown` as the canvas so keyboard semantics are
// identical across surfaces (task 12.5).

import type { VisualBuilderNode } from "../types/index.js";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
} from "lucide-react";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { focusInspectorPanel } from "./canvas.js";
import { handleTreeKeyDown } from "./keyboard.js";
import { blockDisplayName } from "./labels.js";
import {
  useDocument,
  useNode,
  useNodeDepth,
  useSelectedNodeId,
} from "./node-helpers.js";
import {
  useBuilderActions,
  useBuilderMeta,
  useBuilderSelector,
} from "./provider.js";
import { useNodeActions } from "./use-node-actions.js";

function sameNodeIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function nodeMatchesQuery(
  node: VisualBuilderNode,
  displayName: string,
  needle: string,
): boolean {
  return (
    node.type.toLowerCase().includes(needle) ||
    displayName.toLowerCase().includes(needle)
  );
}

interface LayerItemProps {
  nodeId: string;
  query: string;
  expandedIds: ReadonlySet<string>;
  toggleExpanded: (nodeId: string) => void;
}

/**
 * Memoized for the same reason as `CanvasNode` (task 17.2): `Layers`
 * re-renders on any document edit (it needs the current root children), and
 * without memoization every `LayerItem` in the tree would re-execute with
 * it. Own node/depth come from node-scoped selectors so this item still
 * updates independently when it changes; keyboard navigation reads the full
 * document lazily from the controller instead of subscribing to it.
 */
const LayerItem = memo(function LayerItem({
  nodeId,
  query,
  expandedIds,
  toggleExpanded,
}: LayerItemProps): React.JSX.Element | null {
  const node = useNode(nodeId);
  const depth = useNodeDepth(nodeId);
  const selectedNodeId = useSelectedNodeId();
  const actions = useBuilderActions();
  const nodeActions = useNodeActions();
  const { labels, controller } = useBuilderMeta();

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      handleTreeKeyDown(event, {
        document: controller.getState().document,
        nodeId,
        surface: "layers",
        nodeActions,
        select: actions.select,
        focusInspector: focusInspectorPanel,
      });
    },
    [controller, nodeId, nodeActions, actions.select],
  );

  if (!node) return null;

  const displayName = blockDisplayName(labels, node.type);
  const childIds = node.children ?? [];
  const isExpanded = expandedIds.has(nodeId);
  const isSelected = selectedNodeId === nodeId;

  const needle = query.trim().toLowerCase();
  const selfMatches =
    needle === "" || nodeMatchesQuery(node, displayName, needle);

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={childIds.length > 0 ? isExpanded : undefined}
        aria-label={displayName}
        data-vb-layers-node={nodeId}
        tabIndex={isSelected ? 0 : -1}
        className={`donativus-vb-layer-item${isSelected ? " is-selected" : ""}${selfMatches ? "" : " is-filtered-out"}`}
        style={{ paddingInlineStart: `${depth * 12}px` }}
        onKeyDown={onKeyDown}
        onClick={() => {
          actions.select(nodeId);
          // Keep the canvas in sync: bring the selected block into view.
          globalThis.document
            ?.querySelector(
              `[data-vb-canvas-node="${nodeId.replace(/"/g, '\\"')}"]`,
            )
            ?.scrollIntoView?.({ block: "nearest" });
        }}
      >
        {childIds.length > 0 && (
          <button
            type="button"
            className="donativus-vb-layer-expander btn btn-ghost btn-xs"
            aria-label={isExpanded ? labels.collapse : labels.expand}
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(nodeId);
            }}
          >
            {isExpanded ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        )}
        <span className="donativus-vb-layer-name">{displayName}</span>
        {isSelected && (
          <span
            className="donativus-vb-layer-actions join"
            role="toolbar"
            aria-label={labels.blockActionsLabel}
          >
            <button
              type="button"
              className="btn btn-ghost btn-xs join-item"
              aria-label={labels.moveUp}
              onClick={(event) => {
                event.stopPropagation();
                nodeActions.moveWithinParent(nodeId, -1, "layers");
              }}
            >
              <ArrowUp size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs join-item"
              aria-label={labels.moveDown}
              onClick={(event) => {
                event.stopPropagation();
                nodeActions.moveWithinParent(nodeId, 1, "layers");
              }}
            >
              <ArrowDown size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs join-item"
              aria-label={labels.duplicate}
              onClick={(event) => {
                event.stopPropagation();
                nodeActions.duplicate(nodeId, "layers");
              }}
            >
              <Copy size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs join-item"
              aria-label={labels.remove}
              onClick={(event) => {
                event.stopPropagation();
                nodeActions.removeNode(nodeId, "layers");
              }}
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      {childIds.length > 0 && isExpanded && (
        <ul role="group">
          {childIds.map((childId) => (
            <LayerItem
              key={childId}
              nodeId={childId}
              query={query}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export function Layers(): React.JSX.Element {
  const document = useDocument();
  const { labels } = useBuilderMeta();
  const [query, setQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // Node-ID list stays referentially stable across edits that don't add/
  // remove nodes (`useBuilderSelector`'s snapshot memoization), so
  // `expandedIds` below only gets a new identity when the node set or
  // collapsed state actually changes — not on every unrelated edit. Without
  // this, every `LayerItem`'s memoization would be defeated by a fresh
  // `expandedIds` object on each keystroke elsewhere (task 17.2).
  const nodeIds = useBuilderSelector(
    (state) => Object.keys(state.document.nodes),
    sameNodeIds,
  );
  // Expanded-by-default: track collapsed IDs so new nodes appear automatically.
  const expandedIds = useMemo(
    () => new Set(nodeIds.filter((nodeId) => !collapsedIds.has(nodeId))),
    [nodeIds, collapsedIds],
  );
  const toggleExpanded = useCallback((nodeId: string) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const rootChildIds = document.nodes[document.rootId]?.children ?? [];

  return (
    <div className="donativus-vb-layers">
      <input
        type="search"
        className="input input-sm w-full"
        aria-label={labels.searchLayers}
        placeholder={labels.searchLayers}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul
        role="tree"
        aria-label={labels.layersTree}
        className="donativus-vb-layers-tree"
      >
        {rootChildIds.map((childId) => (
          <LayerItem
            key={childId}
            nodeId={childId}
            query={query}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
          />
        ))}
      </ul>
      {rootChildIds.length === 0 && (
        <p className="donativus-vb-empty-hint">{labels.noLayerMatches}</p>
      )}
    </div>
  );
}
