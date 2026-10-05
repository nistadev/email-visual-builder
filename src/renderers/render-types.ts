// The contract a mode's `ModeDefinition.renderer` (typed `unknown` in core —
// design.md decision #4) must satisfy to be invoked by the export pipeline.
// Sections 9-10 register concrete email/landing renderers matching this
// shape; until then no mode has one and `html` stays `null` (task 8.2/8.3).

import type { BuilderRegistries } from "../core/registry/types.js";
import type { VisualBuilderNode, VisualDocument } from "../types/index.js";
import type { RendererContext } from "./traversal.js";

export type ModeRenderer = (
  document: VisualDocument,
  registries: BuilderRegistries,
  options?: ModeRendererOptions,
) => string;

export interface ModeRendererOptions {
  emailAssetBaseUrl?: string;
}

export function isModeRenderer(value: unknown): value is ModeRenderer {
  return typeof value === "function";
}

/**
 * The contract a `BlockDefinition.renderers[mode]` entry (also typed
 * `unknown` in core) must satisfy — a single node's HTML, not a whole
 * document. Lets a consumer-registered custom block participate in email/
 * landing export without core or the built-in renderers knowing its shape.
 */
export type BlockRenderer = (
  node: VisualBuilderNode,
  document: VisualDocument,
  context: RendererContext,
) => string;

export function isBlockRenderer(value: unknown): value is BlockRenderer {
  return typeof value === "function";
}
