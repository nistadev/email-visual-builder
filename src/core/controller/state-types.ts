import type { VisualDocument } from "../../types/index.js";

/**
 * Editor-only state. Never serialized, never sent in a template mutation
 * payload, never stored in tenant `layoutJson` (design.md decision #2).
 * Reopening a saved document always starts with this at its defaults.
 */
export interface EditorTransientState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  openInspectorPanelKey: string | null;
  previewDevice: "desktop" | "tablet" | "mobile";
  uploadProgressByNodeId: Readonly<Record<string, number>>;
}

export interface BuilderState {
  document: VisualDocument;
  transient: EditorTransientState;
}

export function createDefaultTransientState(): EditorTransientState {
  return {
    selectedNodeId: null,
    hoveredNodeId: null,
    openInspectorPanelKey: null,
    previewDevice: "desktop",
    uploadProgressByNodeId: {},
  };
}
