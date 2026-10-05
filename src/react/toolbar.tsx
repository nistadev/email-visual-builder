// The compact top toolbar (task 12.6): undo/redo with live enabled state,
// desktop/tablet/mobile preview widths and a children slot for consumer
// actions (a consumer save button wires through `useBuilderActions().export`
// — no editor ref). Secondary status controls live at the foot of the rail.

import { useCallback, useMemo, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Braces,
  CheckCircle2,
  Eye,
  Monitor,
  Redo2,
  Smartphone,
  TabletSmartphone,
  Undo2,
} from "lucide-react";
import {
  useBuilderMeta,
  useBuilderSelector,
  useEditorChrome,
} from "./provider.js";
import { useDocument, usePreviewDevice } from "./node-helpers.js";
import { useNodeActions } from "./use-node-actions.js";
import { exportVisualDocument } from "../renderers/pipeline.js";

export interface ToolbarProps {
  /** Consumer-provided actions rendered at the trailing edge (e.g. save). */
  children?: ReactNode;
  /** Host-owned document title (e.g. a template name) shown next to undo/redo. Omit `onTitleChange` to leave it out of the toolbar entirely. */
  titleValue?: string;
  /** Shown via the input's `placeholder` when `titleValue` is empty; defaults to `labels.emailTemplateNameLabel` ("Template name"). */
  titlePlaceholder?: string;
  onTitleChange?: (value: string) => void;
}

interface HistoryAvailability {
  canUndo: boolean;
  canRedo: boolean;
}

function historyEquals(
  a: HistoryAvailability,
  b: HistoryAvailability,
): boolean {
  return a.canUndo === b.canUndo && a.canRedo === b.canRedo;
}

function useHistoryAvailability(): HistoryAvailability {
  const { controller } = useBuilderMeta();
  const selector = useCallback(
    (): HistoryAvailability => ({
      canUndo: controller.canUndo(),
      canRedo: controller.canRedo(),
    }),
    [controller],
  );
  return useBuilderSelector(selector, historyEquals);
}

function ValidationStatusChip(): React.JSX.Element {
  const { labels, registries } = useBuilderMeta();
  const { openPanel, setOpenPanel } = useEditorChrome();
  const document = useDocument();
  const result = useMemo(
    () => exportVisualDocument(document, registries),
    [document, registries],
  );
  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;

  const isOpen = openPanel === "validation";
  const status =
    errorCount > 0 ? "errors" : warningCount > 0 ? "warnings" : "valid";
  return (
    <button
      type="button"
      className={`btn btn-sm btn-block justify-start ${
        errorCount > 0
          ? "btn-error"
          : warningCount > 0
            ? "btn-warning"
            : "btn-ghost"
      }`}
      aria-label={labels.validationStatus}
      aria-expanded={isOpen}
      data-vb-validation-status={status}
      onClick={() => setOpenPanel(isOpen ? null : "validation")}
    >
      {errorCount > 0 ? (
        <AlertCircle size={15} aria-hidden="true" />
      ) : warningCount > 0 ? (
        <AlertTriangle size={15} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={15} aria-hidden="true" />
      )}
      <span>
        {errorCount > 0 || warningCount > 0
          ? labels.validationIssues(errorCount, warningCount)
          : labels.validationValid}
      </span>
    </button>
  );
}

/** Status controls live at the bottom of the left rail, away from primary document actions. */
export function SidebarStatusControls({
  notice,
}: {
  /** Host-owned context shown immediately before document validation. */
  notice?: ReactNode;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const { variablePreviewMode, setVariablePreviewMode } = useEditorChrome();
  return (
    <div className="donativus-vb-sidebar-status border-base-300">
      {notice ? (
        <div className="donativus-vb-sidebar-status-notice">{notice}</div>
      ) : null}
      <ValidationStatusChip />
      <button
        type="button"
        className={`btn btn-sm btn-block justify-start${variablePreviewMode === "sample" ? " btn-active" : " btn-ghost"}`}
        aria-pressed={variablePreviewMode === "sample"}
        aria-label={
          variablePreviewMode === "sample"
            ? labels.variablePreviewTokens
            : labels.variablePreviewSamples
        }
        onClick={() =>
          setVariablePreviewMode(
            variablePreviewMode === "sample" ? "token" : "sample",
          )
        }
      >
        <Braces size={15} aria-hidden="true" />
        {variablePreviewMode === "sample"
          ? labels.variablePreviewTokens
          : labels.variablePreviewSamples}
      </button>
    </div>
  );
}

export function Toolbar({
  children,
  titleValue,
  titlePlaceholder,
  onTitleChange,
}: ToolbarProps): React.JSX.Element {
  const { labels, controller } = useBuilderMeta();
  const { openPanel, setOpenPanel } = useEditorChrome();
  const nodeActions = useNodeActions();
  const previewDevice = usePreviewDevice();
  const { canUndo, canRedo } = useHistoryAvailability();

  return (
    <div
      className="donativus-vb-toolbar bg-base-100 border-base-300"
      role="toolbar"
      aria-label={labels.toolbarLabel}
    >
      <span className="join">
        <button
          type="button"
          className="btn btn-sm join-item"
          aria-label={labels.undo}
          disabled={!canUndo}
          onClick={() => nodeActions.undo()}
        >
          <Undo2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-sm join-item"
          aria-label={labels.redo}
          disabled={!canRedo}
          onClick={() => nodeActions.redo()}
        >
          <Redo2 size={16} aria-hidden="true" />
        </button>
      </span>

      {onTitleChange && (
        <input
          type="text"
          className="input input-sm donativus-vb-toolbar-title-input"
          aria-label={labels.emailTemplateNameLabel}
          placeholder={titlePlaceholder ?? labels.emailTemplateNameLabel}
          required
          value={titleValue ?? ""}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      )}

      <span className="donativus-vb-toolbar-spacer" />

      <span
        className="join"
        role="group"
        aria-label={labels.previewDeviceSelector}
      >
        <button
          type="button"
          className={`btn btn-sm join-item${previewDevice === "desktop" ? " btn-active" : ""}`}
          aria-label={labels.deviceDesktop}
          aria-pressed={previewDevice === "desktop"}
          onClick={() => controller.setPreviewDevice("desktop")}
        >
          <Monitor size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-sm join-item${previewDevice === "tablet" ? " btn-active" : ""}`}
          aria-label={labels.deviceTablet}
          aria-pressed={previewDevice === "tablet"}
          onClick={() => controller.setPreviewDevice("tablet")}
        >
          <TabletSmartphone size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-sm join-item${previewDevice === "mobile" ? " btn-active" : ""}`}
          aria-label={labels.deviceMobile}
          aria-pressed={previewDevice === "mobile"}
          onClick={() => controller.setPreviewDevice("mobile")}
        >
          <Smartphone size={16} aria-hidden="true" />
        </button>
      </span>

      <button
        type="button"
        className="btn btn-sm"
        aria-label={labels.openPreview}
        aria-haspopup="dialog"
        aria-expanded={openPanel === "preview"}
        onClick={() => setOpenPanel(openPanel === "preview" ? null : "preview")}
      >
        <Eye size={15} aria-hidden="true" />
        {labels.openPreview}
      </button>

      {children}
    </div>
  );
}
