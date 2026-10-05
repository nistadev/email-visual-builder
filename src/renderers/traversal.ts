// Stable node traversal and the per-export renderer context (design.md
// decision #10, task 8.2). Traversal order is always root-first,
// depth-first, following each container's persisted `children` array — the
// same order for the same document every time, which is what makes
// generated class/media identifiers reproducible across repeated exports of
// unchanged input.

import type {
  VisualBuilderNode,
  VisualBuilderNodeId,
  VisualDocument,
  VisualDocumentMode,
} from "../types/index.js";
import type {
  BuilderRegistries,
  VariableRegistry,
} from "../core/registry/types.js";

export interface VisitedNode {
  node: VisualBuilderNode;
  nodeId: VisualBuilderNodeId;
  depth: number;
}

/**
 * Depth-first, root-first traversal of a document's node tree. Skips a
 * `children` entry that no longer resolves to a node (should not occur in a
 * document that passed `buildTreeIndex`, but traversal itself does not
 * re-validate — callers render only already-validated documents).
 */
export function traverseDocument(document: VisualDocument): VisitedNode[] {
  const visited: VisitedNode[] = [];
  const visit = (nodeId: VisualBuilderNodeId, depth: number): void => {
    const node = document.nodes[nodeId];
    if (!node) return;
    visited.push({ node, nodeId, depth });
    if ("unavailable" in node) return;
    for (const childId of node.children ?? []) {
      visit(childId, depth + 1);
    }
  };
  visit(document.rootId, 0);
  return visited;
}

/**
 * Carried through a single render call so node renderers share one
 * registry/mode/variable view and can mint deterministic, traversal-order
 * class and responsive-media identifiers instead of random or DOM-derived
 * ones. `errors`/`warnings` are the export pipeline's already-computed
 * results, exposed read-only for renderers that want to react to a
 * particular node's issues (e.g. an unsupported-block placeholder).
 */
export class RendererContext {
  readonly registries: BuilderRegistries;
  readonly mode: VisualDocumentMode;
  readonly variables: VariableRegistry;
  readonly emailAssetBaseUrl: string | undefined;

  private classCounter = 0;
  private mediaCounter = 0;
  private readonly mediaRules: string[] = [];

  constructor(
    registries: BuilderRegistries,
    mode: VisualDocumentMode,
    emailAssetBaseUrl?: string,
  ) {
    this.registries = registries;
    this.mode = mode;
    this.variables = registries.variables;
    this.emailAssetBaseUrl = emailAssetBaseUrl;
  }

  /** A stable, deterministic class name — the Nth call in traversal order always yields the same value for the same document. */
  nextClassName(prefix: string): string {
    const name = `${prefix}-${this.classCounter}`;
    this.classCounter += 1;
    return name;
  }

  /** A stable, deterministic responsive-media rule identifier, independent of `nextClassName`'s counter. */
  nextMediaId(prefix: string): string {
    const name = `${prefix}-${this.mediaCounter}`;
    this.mediaCounter += 1;
    return name;
  }

  /** Accumulates a raw CSS rule (e.g. an `@media` block) to be emitted once in the document's `<style>` — collected in traversal order for deterministic output. */
  addMediaRule(css: string): void {
    this.mediaRules.push(css);
  }

  /** All accumulated rules, joined in the order they were added. */
  collectMediaCss(): string {
    return this.mediaRules.join("");
  }
}

export function createRendererContext(
  document: VisualDocument,
  registries: BuilderRegistries,
  options: { emailAssetBaseUrl?: string } = {},
): RendererContext {
  return new RendererContext(
    registries,
    document.mode,
    options.emailAssetBaseUrl,
  );
}
