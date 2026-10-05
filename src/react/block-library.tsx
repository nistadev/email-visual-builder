// Searchable block library (task 12.7). Every item is both a dnd-kit drag
// source and a plain button — clicking inserts into the current insert
// target (selected container, its nearest valid ancestor, or the last root
// section), so keyboard/pointer users never need a drag gesture (task 12.5).

import { useMemo, useState } from "react";
import {
  Columns3,
  GripVertical,
  Heading,
  Image,
  Minus,
  MousePointerClick,
  MoveVertical,
  Pilcrow,
  Rows3,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { listBlockTypesForMode } from "../core/registry/block-registry.js";
import { useLibraryDrag } from "./dnd.js";
import { blockDisplayName } from "./labels.js";
import { useBuilderMeta } from "./provider.js";
import { useNodeActions } from "./use-node-actions.js";

/** Block types a user can insert directly — structural internals (`document-root`, `column`) are managed by their parents. */
const NON_INSERTABLE_TYPES = new Set(["document-root", "column"]);

const BLOCK_ICONS: Record<string, LucideIcon> = {
  section: Rows3,
  columns: Columns3,
  heading: Heading,
  "rich-text": Pilcrow,
  image: Image,
  cta: MousePointerClick,
  divider: Minus,
  spacer: MoveVertical,
  social: Share2,
};

function LibraryItem({ blockType }: { blockType: string }): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const nodeActions = useNodeActions();
  const drag = useLibraryDrag(blockType);
  const displayName = blockDisplayName(labels, blockType);
  const Icon = BLOCK_ICONS[blockType] ?? Rows3;

  return (
    <button
      type="button"
      ref={drag.setNodeRef}
      className={`donativus-vb-library-item btn btn-sm btn-block justify-start${drag.isDragging ? " is-dragging" : ""}`}
      aria-label={labels.insertBlock(displayName)}
      onClick={() => nodeActions.insertBlock(blockType)}
      {...drag.attributes}
      {...drag.listeners}
    >
      <span className="donativus-vb-library-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <span className="donativus-vb-library-item-label">{displayName}</span>
      <GripVertical
        className="donativus-vb-library-grip"
        size={15}
        aria-hidden="true"
      />
    </button>
  );
}

export function BlockLibrary(): React.JSX.Element {
  const { mode, registries, labels } = useBuilderMeta();
  const [query, setQuery] = useState("");

  const insertableTypes = useMemo(
    () =>
      listBlockTypesForMode(registries.blocks, mode).filter(
        (type) => !NON_INSERTABLE_TYPES.has(type),
      ),
    [registries, mode],
  );

  const visibleTypes = insertableTypes.filter((type) => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return true;
    return (
      type.toLowerCase().includes(needle) ||
      blockDisplayName(labels, type).toLowerCase().includes(needle)
    );
  });

  return (
    <div className="donativus-vb-block-library">
      <input
        type="search"
        className="input input-sm w-full"
        aria-label={labels.searchBlocks}
        placeholder={labels.searchBlocks}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        className="donativus-vb-library-list"
        role="list"
        aria-label={labels.blocksTab}
      >
        {visibleTypes.length === 0 ? (
          <p className="donativus-vb-empty-hint">{labels.noBlockMatches}</p>
        ) : (
          visibleTypes.map((type) => (
            <div role="listitem" key={type}>
              <LibraryItem blockType={type} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
