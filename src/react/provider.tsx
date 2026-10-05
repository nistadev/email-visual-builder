// The React 19 provider/context (design.md decision #5, task 12.1). The
// context is deliberately split three ways so consumers subscribe only to
// what they use:
// - state   -> `useBuilderSelector` (selector-aware `useSyncExternalStore`
//              over the headless controller; node-local selectors only
//              re-render on that node's changes because command handlers
//              perform minimal-diff immutable updates).
// - actions -> `useBuilderActions` (stable for the provider's lifetime —
//              never causes re-renders).
// - meta    -> `useBuilderMeta` (mode, registries, variables, labels —
//              stable per provider configuration).
//
// A consumer save button anywhere under the provider calls
// `actions.export()` — there is no imperative editor ref.

import type {
  VariableDefinition,
  VisualDocumentExportResult,
  VisualDocumentMode,
} from "../types/index.js";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { BuilderController } from "../core/controller/controller.js";
import type {
  BuilderCommand,
  CommandResult,
} from "../core/controller/commands.js";
import type { BuilderState } from "../core/controller/state-types.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { exportVisualDocument } from "../renderers/pipeline.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";
import type { AssetAdapter } from "./asset-adapter.js";
import { DEFAULT_BUILDER_LABELS, type BuilderLabels } from "./labels.js";

export interface BuilderActions {
  dispatch: (command: BuilderCommand) => CommandResult;
  undo: () => boolean;
  redo: () => boolean;
  select: (nodeId: string | null) => void;
  hover: (nodeId: string | null) => void;
  setPreviewDevice: (device: "desktop" | "tablet" | "mobile") => void;
  breakHistoryCoalescing: () => void;
  /** Runs the full parse-validate-check-serialize-render pipeline over the current durable document. */
  export: () => VisualDocumentExportResult;
  /** Posts a message to the provider's polite live region (screen-reader announcements for moves, validation changes, …). */
  announce: (message: string) => void;
}

export interface BuilderMeta {
  mode: VisualDocumentMode;
  registries: BuilderRegistries;
  variables: readonly VariableDefinition[];
  labels: BuilderLabels;
  /** Consumer-injected upload adapter (task 13.1). Absent -> the image inspector offers URL entry only. */
  assetAdapter: AssetAdapter | null;
  /** Escape hatch for advanced consumers/tests; prefer `useBuilderSelector`/`useBuilderActions`. */
  controller: BuilderController;
}

/** Transient chrome-only UI state (never in the controller, never persisted). */
export interface EditorChromeState {
  variablePreviewMode: "token" | "sample";
  setVariablePreviewMode: (mode: "token" | "sample") => void;
  /** Which overlay panel is open, if any — validation review or preview. */
  openPanel: "validation" | "preview" | null;
  setOpenPanel: (panel: "validation" | "preview" | null) => void;
}

const ControllerContext = createContext<BuilderController | null>(null);
const ActionsContext = createContext<BuilderActions | null>(null);
const MetaContext = createContext<BuilderMeta | null>(null);
const ChromeContext = createContext<EditorChromeState | null>(null);

export interface BuilderProviderProps {
  controller: BuilderController;
  mode: VisualDocumentMode;
  registries?: BuilderRegistries;
  variables?: readonly VariableDefinition[];
  labels?: Partial<BuilderLabels>;
  /** Upload adapter for the image inspector; omit to allow URL entry only. */
  assetAdapter?: AssetAdapter;
  children: ReactNode;
}

function useContextOrThrow<T>(
  context: React.Context<T | null>,
  hook: string,
): T {
  const value = use(context);
  if (value === null) {
    throw new Error(`${hook} must be used inside a <BuilderProvider>.`);
  }
  return value;
}

export function BuilderProvider({
  controller,
  mode,
  registries = DEFAULT_RENDERER_REGISTRIES,
  variables = [],
  labels,
  assetAdapter,
  children,
}: BuilderProviderProps): React.JSX.Element {
  const [announcement, setAnnouncement] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [variablePreviewMode, setVariablePreviewMode] = useState<
    "token" | "sample"
  >("token");
  const [openPanel, setOpenPanel] = useState<"validation" | "preview" | null>(
    null,
  );

  const actions = useMemo<BuilderActions>(() => {
    let announcementId = 0;
    return {
      dispatch: (command) => controller.dispatch(command),
      undo: () => controller.undo(),
      redo: () => controller.redo(),
      select: (nodeId) => controller.setSelection(nodeId),
      hover: (nodeId) => controller.setHover(nodeId),
      setPreviewDevice: (device) => controller.setPreviewDevice(device),
      breakHistoryCoalescing: () => controller.breakHistoryCoalescing(),
      export: () =>
        exportVisualDocument(controller.getState().document, registries),
      announce: (message) => {
        announcementId += 1;
        setAnnouncement({ id: announcementId, message });
      },
    };
  }, [controller, registries]);

  const meta = useMemo<BuilderMeta>(
    () => ({
      mode,
      registries,
      variables,
      labels: { ...DEFAULT_BUILDER_LABELS, ...labels },
      assetAdapter: assetAdapter ?? null,
      controller,
    }),
    [mode, registries, variables, labels, assetAdapter, controller],
  );

  const chrome = useMemo<EditorChromeState>(
    () => ({
      variablePreviewMode,
      setVariablePreviewMode,
      openPanel,
      setOpenPanel,
    }),
    [variablePreviewMode, openPanel],
  );

  const documentMode = controller.getState().document.mode;
  if (documentMode !== mode) {
    // Decision #3: a preset refuses a document of the other mode — no implicit conversion.
    return (
      <div
        role="alert"
        className="donativus-vb-mode-mismatch alert alert-error"
      >
        {meta.labels.modeMismatch}
      </div>
    );
  }

  return (
    <ControllerContext.Provider value={controller}>
      <ActionsContext.Provider value={actions}>
        <MetaContext.Provider value={meta}>
          <ChromeContext.Provider value={chrome}>
            {children}
            <span
              className="donativus-vb-visually-hidden"
              role="status"
              aria-live="polite"
            >
              {announcement ? announcement.message : ""}
            </span>
          </ChromeContext.Provider>
        </MetaContext.Provider>
      </ActionsContext.Provider>
    </ControllerContext.Provider>
  );
}

export function useBuilderActions(): BuilderActions {
  return useContextOrThrow(ActionsContext, "useBuilderActions");
}

export function useBuilderMeta(): BuilderMeta {
  return useContextOrThrow(MetaContext, "useBuilderMeta");
}

export function useEditorChrome(): EditorChromeState {
  return useContextOrThrow(ChromeContext, "useEditorChrome");
}

interface SelectorMemo<T> {
  state: BuilderState;
  selector: (state: BuilderState) => T;
  value: T;
}

/**
 * Selector-aware external-store subscription. The memoized snapshot only
 * changes identity when the selected slice fails `isEqual`, so a component
 * selecting one node never re-renders for edits to unrelated nodes.
 */
export function useBuilderSelector<T>(
  selector: (state: BuilderState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const controller = useContextOrThrow(ControllerContext, "useBuilderSelector");
  const memoRef = useRef<SelectorMemo<T> | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => controller.subscribe(onStoreChange),
    [controller],
  );

  const getSnapshot = useCallback((): T => {
    const state = controller.getState();
    const memo = memoRef.current;
    // `getState()` allocates a fresh envelope each call; the durable/transient
    // slices inside are only replaced when something actually changed.
    if (
      memo &&
      memo.selector === selector &&
      memo.state.document === state.document &&
      memo.state.transient === state.transient
    ) {
      return memo.value;
    }
    const next = selector(state);
    const value = memo && isEqual(memo.value, next) ? memo.value : next;
    memoRef.current = { state, selector, value };
    return value;
  }, [controller, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
