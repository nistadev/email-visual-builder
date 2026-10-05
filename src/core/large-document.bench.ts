/**
 * Task 17.1 — representative large-document benchmarks/assertions.
 *
 * These are regression trip-wires, not micro-benchmarks: thresholds are
 * deliberately generous (an order of magnitude above observed local timings)
 * so they fail only on a genuine complexity regression (e.g. an
 * accidentally-quadratic pass over the tree), not on ordinary CI jitter.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocumentMode } from "../types/index.js";
import { exportVisualDocument } from "../renderers/pipeline.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";
import {
  buildLargeVisualDocument,
  LARGE_DOCUMENT_CONTENT_BLOCK_TYPES,
  LARGE_DOCUMENT_SECTION_COUNT,
} from "../test-utils/large-document-fixture.js";
import { BuilderController } from "./controller/controller.js";
import { createIdGenerator } from "./controller/id-generator.js";
import { subscribeWithSelector } from "./controller/selectors.js";
import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { parseVisualDocument } from "./parse-document.js";
import { serializeVisualDocument } from "./serialize.js";

const EXPECTED_NODE_COUNT =
  1 +
  LARGE_DOCUMENT_SECTION_COUNT *
    (1 + LARGE_DOCUMENT_CONTENT_BLOCK_TYPES.length);

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

for (const mode of ["email", "landing-page"] as VisualDocumentMode[]) {
  test.describe(`large document (${mode}) — ${EXPECTED_NODE_COUNT} nodes`, () => {
    test("fixture is well under every documented limit", () => {
      const { document } = buildLargeVisualDocument(mode);
      assert.equal(Object.keys(document.nodes).length, EXPECTED_NODE_COUNT);
      assert.ok(
        Object.keys(document.nodes).length <
          VISUAL_DOCUMENT_LIMITS.maxNodeCount,
      );
    });

    test("parse: raw JSON round trip stays fast", () => {
      const { document } = buildLargeVisualDocument(mode);
      const raw = JSON.parse(serializeVisualDocument(document));
      const duration = time(() => {
        const result = parseVisualDocument(raw);
        assert.equal(result.ok, true);
      });
      assert.ok(duration < 500, `parse took ${duration}ms`);
    });

    test("validate: structural + block-constraint validation stays fast", () => {
      const { document } = buildLargeVisualDocument(mode);
      const controller = new BuilderController(document);
      const duration = time(() => {
        const issues = controller.validate();
        assert.deepEqual(issues, []);
      });
      assert.ok(duration < 300, `validate took ${duration}ms`);
    });

    test("serialize: canonical serialization stays fast and deterministic", () => {
      const { document } = buildLargeVisualDocument(mode);
      let first = "";
      const duration = time(() => {
        first = serializeVisualDocument(document);
      });
      const second = serializeVisualDocument(document);
      assert.equal(first, second);
      assert.ok(duration < 200, `serialize took ${duration}ms`);
    });

    test("export: full pipeline produces HTML within the size ceiling, quickly", () => {
      const { document } = buildLargeVisualDocument(mode);
      const raw = JSON.parse(serializeVisualDocument(document));
      let result: ReturnType<typeof exportVisualDocument> | undefined;
      const duration = time(() => {
        result = exportVisualDocument(raw, DEFAULT_RENDERER_REGISTRIES);
      });
      assert.ok(result);
      assert.deepEqual(result!.errors, []);
      assert.ok(typeof result!.html === "string" && result!.html.length > 0);
      const htmlBytes = new TextEncoder().encode(result!.html!).byteLength;
      assert.ok(
        htmlBytes <= VISUAL_DOCUMENT_LIMITS.maxHtmlBytes,
        `exported HTML (${htmlBytes} bytes) exceeded maxHtmlBytes`,
      );
      assert.ok(duration < 1000, `export took ${duration}ms`);
    });

    test("dispatch: a single insert on an already-large document stays fast", () => {
      const { document, sectionIds } = buildLargeVisualDocument(mode);
      const controller = new BuilderController(document, {
        generateId: createIdGenerator("post-bench"),
      });
      const duration = time(() => {
        const result = controller.dispatch({
          type: "insert-node",
          parentId: sectionIds[0]!,
          blockType: "spacer",
        });
        assert.equal(result.ok, true);
      });
      assert.ok(duration < 50, `single dispatch took ${duration}ms`);
    });

    test("dispatch: repeated inserts do not show quadratic blowup", () => {
      const { document, sectionIds } = buildLargeVisualDocument(mode);
      const controller = new BuilderController(document, {
        generateId: createIdGenerator("post-bench"),
      });
      const insertOne = () => {
        const result = controller.dispatch({
          type: "insert-node",
          parentId: sectionIds[0]!,
          blockType: "spacer",
        });
        assert.equal(result.ok, true);
      };
      // Warm up, then compare an early batch to a later batch (on top of a
      // larger document) — a quadratic implementation would make the later
      // batch dramatically slower, not just proportionally slower.
      for (let i = 0; i < 20; i += 1) insertOne();
      const earlyBatch = time(() => {
        for (let i = 0; i < 50; i += 1) insertOne();
      });
      const laterBatch = time(() => {
        for (let i = 0; i < 50; i += 1) insertOne();
      });
      assert.ok(
        laterBatch < earlyBatch * 5 + 50,
        `later batch (${laterBatch}ms) suggests non-linear growth vs early batch (${earlyBatch}ms)`,
      );
    });

    test("undo/redo: bounded history stays fast under repeated edits", () => {
      const { document, sectionIds } = buildLargeVisualDocument(mode);
      const controller = new BuilderController(document, {
        generateId: createIdGenerator("undo-bench"),
      });
      for (let i = 0; i < 150; i += 1) {
        controller.dispatch({
          type: "insert-node",
          parentId: sectionIds[0]!,
          blockType: "spacer",
        });
        controller.breakHistoryCoalescing();
      }
      const duration = time(() => {
        while (controller.canUndo()) controller.undo();
      });
      assert.equal(controller.canUndo(), false);
      assert.ok(duration < 500, `draining undo history took ${duration}ms`);
    });

    test("selectors: node-scoped subscriptions only notify for the touched parent", () => {
      const { document, sectionIds, contentNodeIds } =
        buildLargeVisualDocument(mode);
      const controller = new BuilderController(document, {
        generateId: createIdGenerator("selector-bench"),
      });

      // Inserting a child gives the parent a new object (its `children`
      // array changed) but must not touch the parent's existing children
      // or any unrelated sibling section (design.md decision #5/#13).
      const touchedParentId = sectionIds[0]!;
      const untouchedChildId = contentNodeIds[0]!;
      const untouchedSiblingSectionId = sectionIds[sectionIds.length - 1]!;

      let parentNotifications = 0;
      let childNotifications = 0;
      let siblingNotifications = 0;
      const unsubscribeParent = subscribeWithSelector(
        controller,
        (state) => state.document.nodes[touchedParentId],
        () => {
          parentNotifications += 1;
        },
      );
      const unsubscribeChild = subscribeWithSelector(
        controller,
        (state) => state.document.nodes[untouchedChildId],
        () => {
          childNotifications += 1;
        },
      );
      const unsubscribeSibling = subscribeWithSelector(
        controller,
        (state) => state.document.nodes[untouchedSiblingSectionId],
        () => {
          siblingNotifications += 1;
        },
      );

      const duration = time(() => {
        const result = controller.dispatch({
          type: "insert-node",
          parentId: touchedParentId,
          blockType: "spacer",
        });
        assert.equal(result.ok, true);
      });

      unsubscribeParent();
      unsubscribeChild();
      unsubscribeSibling();

      assert.equal(parentNotifications, 1);
      assert.equal(childNotifications, 0);
      assert.equal(siblingNotifications, 0);
      assert.ok(duration < 50, `dispatch with subscribers took ${duration}ms`);
    });
  });
}
