// Task 12.10 (drag moves): `completeDrag` resolves a finished drag into
// exactly one command — insert for library drags, move for node drags with
// pre-removal slot-index adjustment — and refuses denied targets and cycles.
// Pointer-simulation of dnd-kit is not attempted under jsdom; the sensors
// are dnd-kit's own tested code, and `handleDragEnd` delegates here.

import assert from "node:assert/strict";
import test from "node:test";
import { BuilderController } from "../core/controller/controller.js";
import { createStarterDocument } from "../core/starter-document.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";
import { completeDrag, isDropAllowed } from "./dnd.js";
import type { NodeActions } from "./use-node-actions.js";

function createController(): BuilderController {
  const controller = new BuilderController(
    createStarterDocument("email", DEFAULT_RENDERER_REGISTRIES),
    {
      registries: DEFAULT_RENDERER_REGISTRIES,
    },
  );
  for (const [nodeId, blockType] of [
    ["h1", "heading"],
    ["d1", "divider"],
    ["s2", "spacer"],
  ] as const) {
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType,
        nodeId,
      }).ok,
      true,
    );
  }
  return controller;
}

interface RecordedCall {
  method: "insertBlock" | "moveTo";
  args: unknown[];
}

function recordingNodeActions(controller: BuilderController): {
  actions: NodeActions;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const actions: NodeActions = {
    insertBlock: (blockType, target) => {
      calls.push({ method: "insertBlock", args: [blockType, target] });
      if (target)
        controller.dispatch({
          type: "insert-node",
          parentId: target.parentId,
          blockType,
          index: target.index,
        });
    },
    moveTo: (nodeId, newParentId, index) => {
      calls.push({ method: "moveTo", args: [nodeId, newParentId, index] });
      return controller.dispatch({
        type: "move-node",
        nodeId,
        newParentId,
        index,
      }).ok;
    },
    moveWithinParent: () => assert.fail("not expected"),
    duplicate: () => assert.fail("not expected"),
    removeNode: () => assert.fail("not expected"),
    undo: () => assert.fail("not expected"),
    redo: () => assert.fail("not expected"),
  };
  return { actions, calls };
}

function children(
  controller: BuilderController,
  nodeId: string,
): readonly string[] {
  return controller.getState().document.nodes[nodeId]?.children ?? [];
}

test.describe("completeDrag", () => {
  test("a library drop dispatches exactly one insert command at the slot", () => {
    const controller = createController();
    const { actions, calls } = recordingNodeActions(controller);
    const done = completeDrag(
      controller.getState().document,
      DEFAULT_RENDERER_REGISTRIES,
      actions,
      { source: "library", blockType: "cta" },
      { parentId: "section-1", index: 1 },
    );
    assert.equal(done, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      method: "insertBlock",
      args: ["cta", { parentId: "section-1", index: 1 }],
    });
    assert.equal(
      controller.getState().document.nodes[
        children(controller, "section-1")[1]!
      ]?.type,
      "cta",
    );
  });

  test("moving a node down within its parent adjusts the pre-removal slot index", () => {
    const controller = createController();
    const { actions, calls } = recordingNodeActions(controller);
    // h1 (index 0) dragged onto the slot after s2 (slot index 3): stored move index is 2.
    const done = completeDrag(
      controller.getState().document,
      DEFAULT_RENDERER_REGISTRIES,
      actions,
      { source: "node", nodeId: "h1", blockType: "heading" },
      { parentId: "section-1", index: 3 },
    );
    assert.equal(done, true);
    assert.deepEqual(calls, [
      { method: "moveTo", args: ["h1", "section-1", 2] },
    ]);
    assert.deepEqual(children(controller, "section-1"), ["d1", "s2", "h1"]);
  });

  test("dropping a node onto its adjacent slots is a no-op", () => {
    const controller = createController();
    const { actions, calls } = recordingNodeActions(controller);
    for (const index of [0, 1]) {
      const done = completeDrag(
        controller.getState().document,
        DEFAULT_RENDERER_REGISTRIES,
        actions,
        { source: "node", nodeId: "h1", blockType: "heading" },
        { parentId: "section-1", index },
      );
      assert.equal(done, false);
    }
    assert.equal(calls.length, 0);
    assert.deepEqual(children(controller, "section-1"), ["h1", "d1", "s2"]);
  });

  test("denied targets and cycles dispatch nothing", () => {
    const controller = createController();
    const { actions, calls } = recordingNodeActions(controller);
    const document = controller.getState().document;

    // A section cannot be dropped into a heading (not a container).
    assert.equal(
      isDropAllowed(
        document,
        DEFAULT_RENDERER_REGISTRIES,
        { source: "node", nodeId: "section-1", blockType: "section" },
        { parentId: "h1", index: 0 },
      ),
      false,
    );
    // A section cannot be dropped into its own subtree.
    assert.equal(
      isDropAllowed(
        document,
        DEFAULT_RENDERER_REGISTRIES,
        { source: "node", nodeId: "section-1", blockType: "section" },
        { parentId: "section-1", index: 0 },
      ),
      false,
    );
    // A library heading cannot be dropped on the document root.
    assert.equal(
      completeDrag(
        document,
        DEFAULT_RENDERER_REGISTRIES,
        actions,
        { source: "library", blockType: "heading" },
        { parentId: "root", index: 0 },
      ),
      false,
    );
    // Dropped outside any slot.
    assert.equal(
      completeDrag(
        document,
        DEFAULT_RENDERER_REGISTRIES,
        actions,
        { source: "library", blockType: "heading" },
        null,
      ),
      false,
    );
    assert.equal(calls.length, 0);
  });
});
