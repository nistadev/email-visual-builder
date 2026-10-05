import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocument } from "../../types/index.js";
import { parseVisualDocument } from "../parse-document.js";
import { createValidEmailDocumentInput } from "../../test-utils/visual-document-fixture.js";
import { BuilderController } from "./controller.js";
import {
  selectNode,
  selectSelectedNodeId,
  subscribeWithSelector,
} from "./selectors.js";

function createTestController(): BuilderController {
  const result = parseVisualDocument(createValidEmailDocumentInput());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture failed to parse");
  return new BuilderController(result.value as VisualDocument);
}

test.describe("subscribeWithSelector", () => {
  test("a node-scoped selector does not fire when an unrelated node changes", () => {
    const controller = createTestController();
    let callCount = 0;
    subscribeWithSelector(
      controller,
      (state) => selectNode(state, "rich-text-1"),
      () => {
        callCount += 1;
      },
    );

    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });

    assert.equal(callCount, 0);
  });

  test("a node-scoped selector fires exactly once when its own node changes", () => {
    const controller = createTestController();
    let callCount = 0;
    subscribeWithSelector(
      controller,
      (state) => selectNode(state, "heading-1"),
      () => {
        callCount += 1;
      },
    );

    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });

    assert.equal(callCount, 1);
  });

  test("unrelated node references stay stable (by identity) across an edit elsewhere", () => {
    const controller = createTestController();
    const before = selectNode(controller.getState(), "rich-text-1");
    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });
    const after = selectNode(controller.getState(), "rich-text-1");
    assert.equal(before, after);
  });

  test("a selection selector only fires on selection changes, not on unrelated document edits", () => {
    const controller = createTestController();
    let callCount = 0;
    subscribeWithSelector(controller, selectSelectedNodeId, () => {
      callCount += 1;
    });

    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });
    assert.equal(callCount, 0);

    controller.setSelection("heading-1");
    assert.equal(callCount, 1);

    controller.setSelection("heading-1");
    assert.equal(
      callCount,
      1,
      "re-selecting the same node must not notify again",
    );
  });

  test("identical transient writes do not notify controller subscribers", () => {
    const controller = createTestController();
    let callCount = 0;
    controller.subscribe(() => {
      callCount += 1;
    });

    controller.setSelection("heading-1");
    controller.setSelection("heading-1");
    assert.equal(callCount, 1);

    controller.setHover("rich-text-1");
    controller.setHover("rich-text-1");
    assert.equal(callCount, 2);

    controller.setPreviewDevice("tablet");
    controller.setPreviewDevice("tablet");
    assert.equal(callCount, 3);
  });

  test("unsubscribing stops further notifications", () => {
    const controller = createTestController();
    let callCount = 0;
    const unsubscribe = subscribeWithSelector(
      controller,
      selectSelectedNodeId,
      () => {
        callCount += 1;
      },
    );
    controller.setSelection("heading-1");
    assert.equal(callCount, 1);
    unsubscribe();
    controller.setSelection("rich-text-1");
    assert.equal(callCount, 1);
  });
});
