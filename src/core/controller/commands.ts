import type { VisualDocumentValidationIssue } from "../../types/index.js";

export interface InsertNodeCommand {
  type: "insert-node";
  parentId: string;
  blockType: string;
  /** Position within the parent's children; defaults to the end. */
  index?: number;
  /** Deterministic override, primarily for tests — the controller generates one otherwise. */
  nodeId?: string;
}

export interface RemoveNodeCommand {
  type: "remove-node";
  nodeId: string;
}

export interface MoveNodeCommand {
  type: "move-node";
  nodeId: string;
  newParentId: string;
  index: number;
}

export interface DuplicateNodeCommand {
  type: "duplicate-node";
  nodeId: string;
}

export interface UpdateNodePropsCommand {
  type: "update-node-props";
  nodeId: string;
  /** The complete next `props` value for the node (property, presentation, and templated-link fields all live here). */
  props: unknown;
}

export interface UpdateRichTextCommand {
  type: "update-rich-text";
  nodeId: string;
  value: unknown;
}

export interface UpdateDocumentSettingsCommand {
  type: "update-document-settings";
  settings: unknown;
}

/** Atomically changes a columns block's ratios and structural column count. */
export interface UpdateColumnsCommand {
  type: "update-columns";
  nodeId: string;
  columnWidthRatios: number[];
}

export type BuilderCommand =
  | InsertNodeCommand
  | RemoveNodeCommand
  | MoveNodeCommand
  | DuplicateNodeCommand
  | UpdateNodePropsCommand
  | UpdateRichTextCommand
  | UpdateDocumentSettingsCommand
  | UpdateColumnsCommand;

export interface CommandSuccess {
  ok: true;
  /** The node the controller should select after this command, if any. `undefined` leaves selection untouched. */
  selectedNodeId?: string | null;
}

export interface CommandFailure {
  ok: false;
  issues: VisualDocumentValidationIssue[];
}

export type CommandResult = CommandSuccess | CommandFailure;

export function commandSuccess(selectedNodeId?: string | null): CommandSuccess {
  return selectedNodeId === undefined
    ? { ok: true }
    : { ok: true, selectedNodeId };
}

export function commandFailure(
  issues: VisualDocumentValidationIssue[],
): CommandFailure {
  return { ok: false, issues };
}

/**
 * The dispatch-time key used to decide whether this command should merge
 * into the current top-of-undo-stack entry instead of pushing a new one.
 * `null` means the command always forms its own explicit history entry
 * (design.md decision #4/#5 — structural changes and drag completion are
 * never coalesced).
 */
export function coalesceKeyFor(command: BuilderCommand): string | null {
  switch (command.type) {
    case "update-node-props":
      return `props:${command.nodeId}`;
    case "update-rich-text":
      return `rich-text:${command.nodeId}`;
    case "update-document-settings":
      return "settings";
    default:
      return null;
  }
}
