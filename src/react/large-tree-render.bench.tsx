/**
 * Task 17.2 — profiles React editing against the large fixture (task 17.1)
 * and guards the fix: `CanvasNode`/`LayerItem` used to read the whole
 * document (`useDocument()`) purely for keyboard-navigation context, and
 * neither was memoized, so editing one node re-executed every node
 * component in the canvas and layers trees. Measured before the fix: a
 * single `update-node-props` dispatch against a 501-node document cost
 * ~65ms of render work against a ~330ms full initial mount (~20% of the
 * mount) — clearly the whole tree, not one node. After memoizing both and
 * reading the document lazily (via the controller, not a subscription) for
 * keyboard handling, the same edit costs ~2% of the mount.
 *
 * The assertion below compares the edit's cost to the *same run's* initial
 * mount cost rather than an absolute millisecond ceiling: an absolute
 * threshold is machine/load-dependent (this failed intermittently under CI
 * contention with a fixed 30ms cap even post-fix), while the mount-relative
 * ratio stays stable because both numbers scale together under load —
 * only a real whole-tree re-render pushes the ratio back up near ~20%.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocumentMode } from "../types/index.js";
import { installJsdomGlobals, type JsdomHandle } from "../test-utils/index.js";
import { BuilderController } from "../core/controller/controller.js";
import {
  buildLargeVisualDocument,
  type LargeDocumentFixture,
} from "../test-utils/large-document-fixture.js";

let jsdom: JsdomHandle;
test.before(() => {
  jsdom = installJsdomGlobals();
});
test.after(() => {
  jsdom.cleanup();
});

/** Broken (whole-tree) edits cost ~20% of the initial mount; fixed (node-local) edits cost ~2%. */
const NODE_LOCAL_EDIT_MAX_RATIO_OF_MOUNT = 0.1;

function pickMiddleContentNode(fixture: LargeDocumentFixture): string {
  return fixture.contentNodeIds[Math.floor(fixture.contentNodeIds.length / 2)]!;
}

interface ProfiledEdit {
  mountDuration: number;
  editDuration: number;
}

async function profileNodeLocalEdit(
  mode: VisualDocumentMode,
  renderSurface: (React: typeof import("react")) => React.JSX.Element,
  applyEdit: (controller: BuilderController, targetNodeId: string) => void,
  pickTargetNodeId: (
    fixture: LargeDocumentFixture,
  ) => string = pickMiddleContentNode,
): Promise<ProfiledEdit> {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { BuilderProvider } = await import("./provider.js");

  const fixture = buildLargeVisualDocument(mode);
  const controller = new BuilderController(fixture.document);
  const targetNodeId = pickTargetNodeId(fixture);

  const container = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(container);
  const root = createRoot(container);

  let lastDuration = 0;

  act(() => {
    root.render(
      React.createElement(
        BuilderProvider,
        { controller, mode },
        React.createElement(
          React.Profiler,
          {
            id: "profiled",
            onRender: (_id: string, _phase: string, actualDuration: number) => {
              lastDuration = actualDuration;
            },
          },
          renderSurface(React),
        ),
      ),
    );
  });
  const mountDuration = lastDuration;

  act(() => {
    applyEdit(controller, targetNodeId);
  });
  const editDuration = lastDuration;

  act(() => root.unmount());
  container.remove();
  return { mountDuration, editDuration };
}

function assertEditStaysNodeLocal(
  { mountDuration, editDuration }: ProfiledEdit,
  label: string,
): void {
  const ratio = editDuration / mountDuration;
  assert.ok(
    ratio < NODE_LOCAL_EDIT_MAX_RATIO_OF_MOUNT,
    `expected ${label} to cost under ${NODE_LOCAL_EDIT_MAX_RATIO_OF_MOUNT * 100}% of the initial mount, ` +
      `took ${editDuration}ms vs a ${mountDuration}ms mount (${(ratio * 100).toFixed(1)}%)`,
  );
}

test.describe("large tree — node-local edits stay cheap (not a whole-document re-render)", () => {
  test("Canvas: updating one node's props does not re-render the whole canvas", async () => {
    const { Canvas } = await import("./canvas.js");

    const result = await profileNodeLocalEdit(
      "email",
      (React) => React.createElement(Canvas),
      (controller, targetNodeId) => {
        const node = controller.getState().document.nodes[targetNodeId]!;
        const dispatchResult = controller.dispatch({
          type: "update-node-props",
          nodeId: targetNodeId,
          props: { ...(node.props as Record<string, unknown>) },
        });
        assert.equal(dispatchResult.ok, true);
      },
    );

    assertEditStaysNodeLocal(result, "a node-local canvas update");
  });

  test("Canvas: a rich-text commit does not re-render the whole canvas", async () => {
    const { Canvas } = await import("./canvas.js");

    const result = await profileNodeLocalEdit(
      "email",
      (React) => React.createElement(Canvas),
      (controller, targetNodeId) => {
        const dispatchResult = controller.dispatch({
          type: "update-rich-text",
          nodeId: targetNodeId,
          value: {
            kind: "donativus.rich-text",
            version: 1,
            children: [
              {
                type: "paragraph",
                align: "left",
                children: [
                  { type: "text", text: "Updated in place.", marks: [] },
                ],
              },
            ],
          },
        });
        assert.equal(dispatchResult.ok, true);
      },
      (fixture) => {
        const richTextNodeId = fixture.contentNodeIds.find(
          (nodeId) => fixture.document.nodes[nodeId]?.type === "rich-text",
        );
        assert.ok(richTextNodeId, "fixture must contain a rich-text node");
        return richTextNodeId;
      },
    );

    assertEditStaysNodeLocal(result, "a rich-text commit");
  });

  test("Layers: updating one node's props does not re-render the whole layers tree", async () => {
    const { Layers } = await import("./layers.js");

    const result = await profileNodeLocalEdit(
      "email",
      (React) => React.createElement(Layers),
      (controller, targetNodeId) => {
        const node = controller.getState().document.nodes[targetNodeId]!;
        const dispatchResult = controller.dispatch({
          type: "update-node-props",
          nodeId: targetNodeId,
          props: { ...(node.props as Record<string, unknown>) },
        });
        assert.equal(dispatchResult.ok, true);
      },
    );

    assertEditStaysNodeLocal(result, "a node-local layers update");
  });
});
