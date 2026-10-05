// Task 12.10: provider context split, compound customization (export through
// context, no editor ref), selection, and node-local rerender behavior.

import assert from "node:assert/strict";
import test from "node:test";
import { installJsdomGlobals, type JsdomHandle } from "../test-utils/index.js";
import { BuilderController } from "../core/controller/controller.js";
import { createStarterDocument } from "../core/starter-document.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";

let jsdom: JsdomHandle;

/** Deterministic controller over the email starter document with a heading and divider in the section. */
function createTestController(): BuilderController {
  const controller = new BuilderController(
    createStarterDocument("email", DEFAULT_RENDERER_REGISTRIES),
    {
      registries: DEFAULT_RENDERER_REGISTRIES,
    },
  );
  assert.equal(
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "heading",
      nodeId: "h1",
    }).ok,
    true,
  );
  assert.equal(
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "divider",
      nodeId: "d1",
    }).ok,
    true,
  );
  return controller;
}

test.describe("BuilderProvider", () => {
  test.before(() => {
    jsdom = installJsdomGlobals();
  });
  test.after(async () => {
    await jsdom.cleanup();
  });

  test("a consumer action exports through the shared context without an imperative ref", async () => {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const { BuilderProvider, useBuilderActions } =
      await import("./provider.js");
    const { fireEvent } = await import("@testing-library/dom");

    const controller = createTestController();
    let exportedHtml: string | null | undefined;

    function SaveButton(): React.JSX.Element {
      const actions = useBuilderActions();
      return (
        <button
          type="button"
          onClick={() => (exportedHtml = actions.export().html)}
        >
          save
        </button>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <BuilderProvider controller={controller} mode="email">
          <SaveButton />
        </BuilderProvider>,
      );
    });

    const button = container.querySelector("button");
    assert.ok(button);
    act(() => {
      fireEvent.click(button);
    });

    assert.equal(typeof exportedHtml, "string");
    assert.match(exportedHtml as string, /<!doctype html/i);

    act(() => root.unmount());
    container.remove();
  });

  test("node-local edits only rerender subscribers of that node", async () => {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const { BuilderProvider } = await import("./provider.js");
    const { useNode } = await import("./node-helpers.js");

    const controller = createTestController();
    const renderCounts: Record<string, number> = {};

    function Probe({ nodeId }: { nodeId: string }): React.JSX.Element {
      renderCounts[nodeId] = (renderCounts[nodeId] ?? 0) + 1;
      const node = useNode(nodeId);
      return <span data-testid={nodeId}>{node?.type}</span>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <BuilderProvider controller={controller} mode="email">
          <Probe nodeId="h1" />
          <Probe nodeId="d1" />
        </BuilderProvider>,
      );
    });

    const headingRendersBefore = renderCounts.h1 ?? 0;
    const dividerRendersBefore = renderCounts.d1 ?? 0;

    act(() => {
      const heading = controller.getState().document.nodes.h1;
      assert.ok(heading);
      const result = controller.dispatch({
        type: "update-node-props",
        nodeId: "h1",
        props: { ...(heading.props as Record<string, unknown>), level: 3 },
      });
      assert.equal(result.ok, true);
    });

    assert.ok(
      (renderCounts.h1 ?? 0) > headingRendersBefore,
      "edited node subscriber must rerender",
    );
    assert.equal(
      renderCounts.d1,
      dividerRendersBefore,
      "unrelated node subscriber must not rerender",
    );

    act(() => root.unmount());
    container.remove();
  });

  test("selection flows through transient state and the mode mismatch is refused", async () => {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const { BuilderProvider } = await import("./provider.js");
    const { useSelectedNodeId } = await import("./node-helpers.js");

    const controller = createTestController();
    controller.setSelection(null); // inserts above selected the last-inserted node

    function SelectionProbe(): React.JSX.Element {
      const selected = useSelectedNodeId();
      return <output>{selected ?? "none"}</output>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <BuilderProvider controller={controller} mode="email">
          <SelectionProbe />
        </BuilderProvider>,
      );
    });

    assert.equal(container.querySelector("output")?.textContent, "none");
    act(() => controller.setSelection("h1"));
    assert.equal(container.querySelector("output")?.textContent, "h1");

    // Mode mismatch: an email document refuses the landing-page preset mode.
    act(() => {
      root.render(
        <BuilderProvider controller={controller} mode="landing-page">
          <SelectionProbe />
        </BuilderProvider>,
      );
    });
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(container.querySelector("output"), null);

    act(() => root.unmount());
    container.remove();
  });
});
