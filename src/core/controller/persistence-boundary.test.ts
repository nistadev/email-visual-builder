import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocument } from "../../types/index.js";
import { parseVisualDocument } from "../parse-document.js";
import { serializeVisualDocument } from "../serialize.js";
import { createValidEmailDocumentInput } from "../../test-utils/visual-document-fixture.js";
import { BuilderController } from "./controller.js";

const FORBIDDEN_KEYS = [
  "history",
  "undoStack",
  "redoStack",
  "transient",
  "selection",
  "selectedNodeId",
  "hoveredNodeId",
  "previewDevice",
  "uploadProgress",
  "openInspectorPanelKey",
];

function assertNoForbiddenKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenKeys(item, `${path}[${index}]`),
    );
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      assert.ok(
        !FORBIDDEN_KEYS.includes(key),
        `transient/history key "${key}" leaked into persisted output at ${path}.${key}`,
      );
      assertNoForbiddenKeys(nested, `${path}.${key}`);
    }
  }
}

function createTestController(): BuilderController {
  const result = parseVisualDocument(createValidEmailDocumentInput());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture failed to parse");
  return new BuilderController(result.value as VisualDocument);
}

test.describe("persistence boundary", () => {
  test("canonical JSON never carries transient or history state, even mid-session", () => {
    const controller = createTestController();
    controller.setSelection("heading-1");
    controller.setHover("rich-text-1");
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    controller.undo();

    const result = controller.export();
    assert.ok(result.json);
    assertNoForbiddenKeys(JSON.parse(result.json ?? "{}"));

    const directJson = serializeVisualDocument(controller.getState().document);
    assertNoForbiddenKeys(JSON.parse(directJson));
  });

  test("getState().document itself has no transient/history fields (it's what gets persisted)", () => {
    const controller = createTestController();
    controller.setSelection("heading-1");
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });

    assertNoForbiddenKeys(controller.getState().document);
  });

  test("restoring a saved document via parseVisualDocument round-trips into a controller with empty history", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    assert.equal(controller.canUndo(), true);

    const exported = controller.export();
    assert.ok(exported.json);
    const restored = parseVisualDocument(JSON.parse(exported.json as string));
    assert.equal(restored.ok, true);
    if (!restored.ok) return;

    const reopened = new BuilderController(restored.value);
    assert.equal(reopened.canUndo(), false);
    assert.equal(reopened.canRedo(), false);
    assert.equal(reopened.getState().transient.selectedNodeId, null);
  });

  test("loadDocument on an existing controller (reopening a saved document) discards prior history", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });
    controller.setSelection("heading-1");
    assert.equal(controller.canUndo(), true);

    const savedDocument = controller.getState().document;
    controller.loadDocument(savedDocument);

    assert.equal(controller.canUndo(), false);
    assert.equal(controller.canRedo(), false);
    assert.equal(controller.getState().transient.selectedNodeId, null);
  });
});
