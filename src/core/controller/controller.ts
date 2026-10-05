import type {
  VisualDocument,
  VisualDocumentExportResult,
} from "../../types/index.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../registry/default-registries.js";
import type { BuilderRegistries } from "../registry/types.js";
import { serializeVisualDocument } from "../serialize.js";
import { collectUnavailableNodeIssues } from "../unavailable-nodes.js";
import { validateBlockConstraints } from "../validate-block-constraints.js";
import { buildTreeIndex } from "../tree.js";
import {
  coalesceKeyFor,
  type BuilderCommand,
  type CommandResult,
} from "./commands.js";
import { executeCommand } from "./command-handlers.js";
import { createIdGenerator, type IdGenerator } from "./id-generator.js";
import {
  createDefaultTransientState,
  type BuilderState,
  type EditorTransientState,
} from "./state-types.js";

/** Bounded undo/redo depth — a documented, generous ceiling, not a tuning knob exposed to consumers. */
const HISTORY_LIMIT = 100;

export interface BuilderControllerOptions {
  registries?: BuilderRegistries;
  generateId?: IdGenerator;
}

/**
 * The headless controller/store (design.md decision #5). Owns the durable
 * document and transient editor state, but exposes them separately —
 * `document`/`json`/`html` never carry transient state, and undo/redo
 * history lives only here, never in what gets persisted.
 */
export class BuilderController {
  private document: VisualDocument;
  private transient: EditorTransientState;
  private readonly registries: BuilderRegistries;
  private readonly generateId: IdGenerator;

  private undoStack: VisualDocument[] = [];
  private redoStack: VisualDocument[] = [];
  private lastCoalesceKey: string | null = null;

  private readonly listeners = new Set<() => void>();

  constructor(
    document: VisualDocument,
    options: BuilderControllerOptions = {},
  ) {
    this.document = document;
    this.transient = createDefaultTransientState();
    this.registries = options.registries ?? DEFAULT_BUILDER_REGISTRIES;
    this.generateId = options.generateId ?? createIdGenerator();
  }

  getState(): BuilderState {
    return { document: this.document, transient: this.transient };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(command: BuilderCommand): CommandResult {
    const result = executeCommand(
      this.document,
      this.registries,
      command,
      this.generateId,
    );
    if (!result.ok) return result;

    const previousDocument = this.document;
    this.pushHistoryEntry(previousDocument, coalesceKeyFor(command));
    this.document = result.document;
    this.applySelectionChange(result.selectedNodeId);
    this.pruneDanglingSelection();
    this.notify();

    return result.selectedNodeId === undefined
      ? { ok: true }
      : { ok: true, selectedNodeId: result.selectedNodeId };
  }

  /** Forces the next command to start a new history entry instead of coalescing with the last one (e.g. on inspector blur). */
  breakHistoryCoalescing(): void {
    this.lastCoalesceKey = null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.document);
    this.document = previous;
    this.lastCoalesceKey = null;
    this.pruneDanglingSelection();
    this.notify();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.document);
    this.document = next;
    this.lastCoalesceKey = null;
    this.pruneDanglingSelection();
    this.notify();
    return true;
  }

  /** Replaces the durable document and resets all editor state, including history — matches reopening a saved document. */
  loadDocument(document: VisualDocument): void {
    this.document = document;
    this.transient = createDefaultTransientState();
    this.undoStack = [];
    this.redoStack = [];
    this.lastCoalesceKey = null;
    this.notify();
  }

  setSelection(nodeId: string | null): void {
    if (this.transient.selectedNodeId === nodeId) return;
    this.transient = { ...this.transient, selectedNodeId: nodeId };
    this.notify();
  }

  setHover(nodeId: string | null): void {
    if (this.transient.hoveredNodeId === nodeId) return;
    this.transient = { ...this.transient, hoveredNodeId: nodeId };
    this.notify();
  }

  setPreviewDevice(device: "desktop" | "tablet" | "mobile"): void {
    if (this.transient.previewDevice === device) return;
    this.transient = { ...this.transient, previewDevice: device };
    this.notify();
  }

  /** Lightweight structural validation. Mode/quality checks and HTML rendering are added by `export()` once section 8's pipeline lands. */
  validate() {
    const treeResult = buildTreeIndex(
      this.document.rootId,
      this.document.nodes,
    );
    const treeIssues = treeResult.ok ? [] : treeResult.issues;
    return [
      ...treeIssues,
      ...collectUnavailableNodeIssues(this.document),
      ...validateBlockConstraints(this.document, this.registries),
    ];
  }

  /**
   * Snapshots the current durable document and runs it through
   * parse-independent validation + canonical serialization. `html` is
   * always `null` here — rendering is added once the `renderers` entrypoint
   * exists (sections 8-10); the result shape does not change.
   */
  export(): VisualDocumentExportResult {
    const errors = this.validate();
    const json =
      errors.length === 0 ? serializeVisualDocument(this.document) : null;
    return {
      document: this.document,
      json,
      html: null,
      errors,
      warnings: [],
    };
  }

  private pushHistoryEntry(
    previousDocument: VisualDocument,
    coalesceKey: string | null,
  ): void {
    if (coalesceKey !== null && coalesceKey === this.lastCoalesceKey) {
      // Merge into the run already started by the previous entry — don't push a new undo point.
      return;
    }
    if (this.undoStack.length >= HISTORY_LIMIT) {
      this.undoStack.shift();
    }
    this.undoStack.push(previousDocument);
    this.redoStack = [];
    this.lastCoalesceKey = coalesceKey;
  }

  private applySelectionChange(
    selectedNodeId: string | null | undefined,
  ): void {
    if (selectedNodeId === undefined) return;
    this.transient = { ...this.transient, selectedNodeId };
  }

  private pruneDanglingSelection(): void {
    const { selectedNodeId, hoveredNodeId } = this.transient;
    const nextSelected =
      selectedNodeId && this.document.nodes[selectedNodeId]
        ? selectedNodeId
        : null;
    const nextHovered =
      hoveredNodeId && this.document.nodes[hoveredNodeId]
        ? hoveredNodeId
        : null;
    if (nextSelected !== selectedNodeId || nextHovered !== hoveredNodeId) {
      this.transient = {
        ...this.transient,
        selectedNodeId: nextSelected,
        hoveredNodeId: nextHovered,
      };
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
