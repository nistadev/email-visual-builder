// The workspace composition (task 12.9): wide three-pane layout (left rail
// with Blocks/Layers tabs, centered canvas, right inspector) collapsing to
// inline sidebars at narrow widths. All chrome uses daisyUI semantic
// color/radius tokens; the only document-styled surface is the canvas page.
// Also hosts the dnd context and workspace-level undo/redo shortcuts.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { PanelLeft, SlidersHorizontal } from "lucide-react";
import { BuilderDndContext } from "./dnd.js";
import { handleHistoryKeyDown } from "./keyboard.js";
import { useSelectedNodeId } from "./node-helpers.js";
import { useBuilderMeta } from "./provider.js";
import { useNodeActions } from "./use-node-actions.js";

const NARROW_BREAKPOINT_PX = 900;

export type WorkspaceLayout = "auto" | "wide" | "narrow";

export interface WorkspaceProps {
  /** Left rail content — the presets pass tabbed Blocks/Layers. */
  library: ReactNode;
  /** Right rail content — the presets pass the Inspector. */
  inspector: ReactNode;
  /** Center content — the presets pass the Canvas plus overlay panels. */
  children: ReactNode;
  /** Host-owned status context that belongs in the sidebar on wide layouts and above the responsive workspace controls when narrow. */
  narrowStatusNotice?: ReactNode;
  /** `auto` observes the workspace's own width; `wide`/`narrow` force a layout (tests, embedding). */
  layout?: WorkspaceLayout;
}

interface InlineSidebarProps {
  id: string;
  label: string;
  side: "left" | "right";
  children: ReactNode;
}

/** Narrow-layout sidebar that stays in the workspace flow rather than covering the canvas. */
function InlineSidebar({
  id,
  label,
  side,
  children,
}: InlineSidebarProps): React.JSX.Element {
  return (
    <aside
      id={id}
      className={`donativus-vb-inline-sidebar bg-base-100 border-base-300 is-${side}`}
      aria-label={label}
    >
      {children}
    </aside>
  );
}

export function Workspace({
  library,
  inspector,
  children,
  narrowStatusNotice,
  layout = "auto",
}: WorkspaceProps): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const nodeActions = useNodeActions();
  const selectedNodeId = useSelectedNodeId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [measuredNarrow, setMeasuredNarrow] = useState(false);
  const [openSidebar, setOpenSidebar] = useState<
    "library" | "inspector" | null
  >(null);
  const librarySidebarId = useId();
  const inspectorSidebarId = useId();

  useEffect(() => {
    if (layout !== "auto") return;
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? Number.POSITIVE_INFINITY;
      setMeasuredNarrow(width < NARROW_BREAKPOINT_PX);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [layout]);

  const isNarrow = layout === "narrow" || (layout === "auto" && measuredNarrow);

  useEffect(() => {
    if (!isNarrow) setOpenSidebar(null);
  }, [isNarrow]);

  useEffect(() => {
    if (isNarrow && selectedNodeId) setOpenSidebar("inspector");
  }, [isNarrow, selectedNodeId]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      handleHistoryKeyDown(event, nodeActions);
    },
    [nodeActions],
  );

  return (
    <BuilderDndContext>
      {/* Workspace-level undo/redo shortcuts; every operation also has a labeled control. */}
      <div
        ref={rootRef}
        className={`donativus-vb-workspace bg-base-200${isNarrow ? " is-narrow" : ""}`}
        data-vb-layout={isNarrow ? "narrow" : "wide"}
        onKeyDown={onKeyDown}
      >
        {isNarrow ? (
          <>
            {narrowStatusNotice ? (
              <div className="donativus-vb-narrow-status-notice">
                {narrowStatusNotice}
              </div>
            ) : null}
            <div className="donativus-vb-narrow-bar bg-base-100 border-base-300">
              <button
                type="button"
                className="btn btn-sm"
                aria-controls={librarySidebarId}
                aria-expanded={openSidebar === "library"}
                onClick={() =>
                  setOpenSidebar((current) =>
                    current === "library" ? null : "library",
                  )
                }
              >
                <PanelLeft size={16} aria-hidden="true" />
                {labels.openLibraryDrawer}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-controls={inspectorSidebarId}
                aria-expanded={openSidebar === "inspector"}
                onClick={() =>
                  setOpenSidebar((current) =>
                    current === "inspector" ? null : "inspector",
                  )
                }
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                {labels.openInspectorDrawer}
              </button>
            </div>
            <div
              className={`donativus-vb-narrow-content${openSidebar ? ` has-inline-sidebar has-inline-sidebar-${openSidebar}` : ""}`}
            >
              {openSidebar === "library" && (
                <InlineSidebar
                  id={librarySidebarId}
                  label={labels.openLibraryDrawer}
                  side="left"
                >
                  {library}
                </InlineSidebar>
              )}
              <div className="donativus-vb-center">{children}</div>
              {openSidebar === "inspector" && (
                <InlineSidebar
                  id={inspectorSidebarId}
                  label={labels.openInspectorDrawer}
                  side="right"
                >
                  {inspector}
                </InlineSidebar>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="donativus-vb-left-rail bg-base-100 border-base-300">
              {library}
            </div>
            <div className="donativus-vb-center">{children}</div>
            <div className="donativus-vb-right-rail">{inspector}</div>
          </>
        )}
      </div>
    </BuilderDndContext>
  );
}

/** Tabbed Blocks/Layers rail used by the default presets. */
export function LibraryRail({
  blocks,
  layers,
}: {
  blocks: ReactNode;
  layers: ReactNode;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const [activeTab, setActiveTab] = useState<"blocks" | "layers">("blocks");
  const blocksTabId = useId();
  const layersTabId = useId();
  const blocksPanelId = useId();
  const layersPanelId = useId();

  return (
    <div className="donativus-vb-library-rail">
      <div
        role="tablist"
        className="tabs tabs-border"
        aria-label={`${labels.blocksTab} / ${labels.layersTab}`}
      >
        <button
          type="button"
          role="tab"
          id={blocksTabId}
          aria-controls={blocksPanelId}
          aria-selected={activeTab === "blocks"}
          className={`tab${activeTab === "blocks" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("blocks")}
        >
          {labels.blocksTab}
        </button>
        <button
          type="button"
          role="tab"
          id={layersTabId}
          aria-controls={layersPanelId}
          aria-selected={activeTab === "layers"}
          className={`tab${activeTab === "layers" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("layers")}
        >
          {labels.layersTab}
        </button>
      </div>
      <div
        role="tabpanel"
        id={blocksPanelId}
        aria-labelledby={blocksTabId}
        hidden={activeTab !== "blocks"}
      >
        {blocks}
      </div>
      <div
        role="tabpanel"
        id={layersPanelId}
        aria-labelledby={layersTabId}
        hidden={activeTab !== "layers"}
      >
        {layers}
      </div>
    </div>
  );
}
