/**
 * A representative large document (task 17.1) for parse/dispatch/undo/
 * validate/serialize/export benchmarks and React rerender profiling.
 * Built by dispatching real `insert-node` commands against a starter
 * document — the same path authoring goes through — rather than
 * hand-rolled JSON, so it stays valid as block defaults evolve. Comfortably
 * under every `VISUAL_DOCUMENT_LIMITS` ceiling (node count, children per
 * node, depth) so it stresses realistic large-authoring scale without
 * exercising the separate limit-boundary tests in `limits.test.ts`.
 */
import type { VisualDocument, VisualDocumentMode } from "../types/index.js";
import { BuilderController } from "../core/controller/controller.js";
import { createIdGenerator } from "../core/controller/id-generator.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../core/registry/default-registries.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { createStarterDocument } from "../core/starter-document.js";

export const LARGE_DOCUMENT_SECTION_COUNT = 100;
export const LARGE_DOCUMENT_CONTENT_BLOCK_TYPES = [
  "heading",
  "rich-text",
  "cta",
  "divider",
] as const;

export interface LargeDocumentFixture {
  document: VisualDocument;
  sectionIds: string[];
  /** One node ID per inserted content block, in insertion order. */
  contentNodeIds: string[];
}

/**
 * `sectionCount` sections directly under the root, each holding one of
 * every type in `LARGE_DOCUMENT_CONTENT_BLOCK_TYPES` — by default 100
 * sections * (1 + 4) = 501 total nodes.
 */
export function buildLargeVisualDocument(
  mode: VisualDocumentMode,
  options: {
    sectionCount?: number;
    registries?: BuilderRegistries;
  } = {},
): LargeDocumentFixture {
  const sectionCount = options.sectionCount ?? LARGE_DOCUMENT_SECTION_COUNT;
  const registries = options.registries ?? DEFAULT_BUILDER_REGISTRIES;
  const controller = new BuilderController(
    createStarterDocument(mode, registries),
    {
      registries,
      generateId: createIdGenerator("bench"),
    },
  );

  const rootId = controller.getState().document.rootId;
  const startingSectionId =
    controller.getState().document.nodes[rootId]?.children?.[0];
  if (!startingSectionId) {
    throw new Error("Starter document is missing its root section.");
  }

  const sectionIds: string[] = [startingSectionId];
  for (let index = 1; index < sectionCount; index += 1) {
    const result = controller.dispatch({
      type: "insert-node",
      parentId: rootId,
      blockType: "section",
    });
    if (!result.ok) {
      throw new Error(
        `Failed to insert section ${index}: ${JSON.stringify(result.issues)}`,
      );
    }
    sectionIds.push(result.selectedNodeId as string);
  }

  const contentNodeIds: string[] = [];
  for (const sectionId of sectionIds) {
    for (const blockType of LARGE_DOCUMENT_CONTENT_BLOCK_TYPES) {
      const result = controller.dispatch({
        type: "insert-node",
        parentId: sectionId,
        blockType,
      });
      if (!result.ok) {
        throw new Error(
          `Failed to insert "${blockType}" into "${sectionId}": ${JSON.stringify(result.issues)}`,
        );
      }
      contentNodeIds.push(result.selectedNodeId as string);
    }
  }

  return {
    document: controller.getState().document,
    sectionIds,
    contentNodeIds,
  };
}
