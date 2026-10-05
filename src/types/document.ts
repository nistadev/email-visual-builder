// The canonical, versioned, restorable visual-document contract. See
// design.md decisions #2 and #3: mode is an immutable discriminant, nodes
// are a normalized record keyed by stable ID with derived (never persisted)
// parent pointers, and this shape is the sole persistence format — no
// selection/hover/history/preview-device state may ever appear here.

import type { PositiveInteger } from "./shared.js";
import type { VisualBuilderBuiltInNode } from "./blocks.js";
import type { VisualBuilderNodeId } from "./document-node.js";
import type {
  VisualDocumentEmailSettings,
  VisualDocumentLandingPageSettings,
} from "./document-settings.js";

export type VisualDocumentMode = "email" | "landing-page";

/**
 * A node whose type is absent from the active block registry. Parsing MUST
 * preserve it verbatim rather than discard it — the canvas renders an
 * unsupported-block placeholder and strict export blocks on it. See
 * design.md decision #4.
 */
export interface UnavailableVisualBuilderNode {
  id: VisualBuilderNodeId;
  type: string;
  version: PositiveInteger;
  props: Record<string, unknown>;
  children?: VisualBuilderNodeId[];
  unavailable: true;
}

/**
 * Every node shape this package knows about statically: the built-in blocks
 * plus preserved-unavailable nodes. A consumer's core registry may parse
 * additional plugin-defined block types into their own `VisualDocumentNode`
 * shapes at runtime; those extend this union within the registry layer
 * rather than being enumerable here.
 */
export type VisualBuilderNode =
  VisualBuilderBuiltInNode | UnavailableVisualBuilderNode;

export type VisualBuilderNodeRecord = Record<
  VisualBuilderNodeId,
  VisualBuilderNode
>;

interface VisualDocumentBase<TMode extends VisualDocumentMode, TSettings> {
  kind: "donativus.visual-document";
  schemaVersion: PositiveInteger;
  mode: TMode;
  rootId: VisualBuilderNodeId;
  nodes: VisualBuilderNodeRecord;
  settings: TSettings;
}

export type EmailVisualDocument = VisualDocumentBase<
  "email",
  VisualDocumentEmailSettings
>;
export type LandingPageVisualDocument = VisualDocumentBase<
  "landing-page",
  VisualDocumentLandingPageSettings
>;

/** The canonical document. Refuse to open/export one mode through the other preset — no implicit conversion exists. */
export type VisualDocument = EmailVisualDocument | LandingPageVisualDocument;
