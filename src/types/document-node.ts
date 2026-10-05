import type { PositiveInteger } from "./shared.js";

export type VisualBuilderNodeId = string;

/**
 * Common envelope for every node in a visual document's normalized `nodes`
 * record. `children` is present only on container node types; parent
 * pointers are always derived, never persisted. `version` is the node's
 * block schema version, independent of the document's own `schemaVersion`.
 */
export interface VisualDocumentNode<TType extends string, TProps> {
  id: VisualBuilderNodeId;
  type: TType;
  version: PositiveInteger;
  props: TProps;
  children?: VisualBuilderNodeId[];
}
