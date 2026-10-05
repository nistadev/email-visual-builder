import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocument } from "../../types/index.js";
import { parseVisualDocument } from "../parse-document.js";
import { createBlockRegistry } from "../registry/block-registry.js";
import { createBuilderRegistries } from "../registry/builder-registries.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../registry/default-registries.js";
import type { BlockDefinition } from "../registry/types.js";
import { createValidEmailDocumentInput } from "../../test-utils/visual-document-fixture.js";
import { BuilderController } from "./controller.js";
import { createIdGenerator } from "./id-generator.js";

function createTestDocument(): VisualDocument {
  const result = parseVisualDocument(createValidEmailDocumentInput());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture failed to parse");
  return result.value;
}

function createTestController(): BuilderController {
  return new BuilderController(createTestDocument(), {
    generateId: createIdGenerator("test"),
  });
}

test.describe("BuilderController — getState", () => {
  test("starts with default transient state and the given document", () => {
    const controller = createTestController();
    const state = controller.getState();
    assert.equal(state.transient.selectedNodeId, null);
    assert.equal(state.transient.previewDevice, "desktop");
    assert.equal(Object.keys(state.document.nodes).length, 4);
  });
});

test.describe("BuilderController — insert-node", () => {
  test("inserts a node with registry defaults, a deterministic ID, and selects it", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.selectedNodeId, "test-1");

    const state = controller.getState();
    assert.equal(state.transient.selectedNodeId, "test-1");
    const inserted = state.document.nodes["test-1"];
    assert.ok(inserted);
    assert.equal(inserted.type, "spacer");
    assert.deepEqual((inserted as { props: { heightPx: number } }).props, {
      heightPx: 16,
      width: { unit: "percent", value: 100 },
      align: "left",
      margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    });
    assert.ok(
      (state.document.nodes["section-1"].children ?? []).includes("test-1"),
    );
  });

  test("respects an explicit index and an explicit nodeId override", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
      index: 0,
      nodeId: "custom-id",
    });
    const { document } = controller.getState();
    assert.deepEqual(document.nodes["section-1"].children, [
      "custom-id",
      "heading-1",
      "rich-text-1",
    ]);
  });

  test("fails atomically for an unregistered block type, leaving the document unchanged", () => {
    const controller = createTestController();
    const before = controller.getState().document;
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "does-not-exist",
    });
    assert.equal(result.ok, false);
    assert.equal(controller.getState().document, before);
  });

  test("fails atomically when the child type is disallowed by the parent", () => {
    const controller = createTestController();
    const before = controller.getState().document;
    // "heading-1" is a leaf, not a container — nothing may be inserted into it.
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "heading-1",
      blockType: "spacer",
    });
    assert.equal(result.ok, false);
    assert.equal(controller.getState().document, before);
  });

  test("rejects placing a content block directly under the document root", () => {
    const controller = createTestController();
    const before = controller.getState().document;
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "root",
      blockType: "spacer",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "command/disallowed-child-type",
      ),
    );
    assert.equal(controller.getState().document, before);
  });

  test("allows placing a new section directly under the document root", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "root",
      blockType: "section",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(controller.getState().document.nodes.root.children, [
      "section-1",
      result.selectedNodeId,
    ]);
  });

  test("inserting columns atomically creates two usable column containers", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    assert.equal(result.ok, true);
    const columns = controller.getState().document.nodes["columns-1"];
    assert.equal(columns?.children?.length, 2);
    for (const columnId of columns?.children ?? []) {
      assert.equal(
        controller.getState().document.nodes[columnId]?.type,
        "column",
      );
    }
    assert.equal(controller.canUndo(), true);
    controller.undo();
    assert.equal(
      controller.getState().document.nodes["columns-1"],
      undefined,
      "one undo removes the whole region",
    );
  });

  test("allows a columns layout to be nested inside a column", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "outer-columns",
    });
    const firstColumnId =
      controller.getState().document.nodes["outer-columns"]?.children?.[0];
    assert.ok(firstColumnId);

    const result = controller.dispatch({
      type: "insert-node",
      parentId: firstColumnId,
      blockType: "columns",
      nodeId: "nested-columns",
    });
    assert.equal(result.ok, true);
    assert.equal(
      controller.getState().document.nodes["nested-columns"]?.children?.length,
      2,
    );
  });

  test("rejects nesting a section inside another section", () => {
    const controller = createTestController();
    const before = controller.getState().document;
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "section",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "command/disallowed-child-type",
      ),
    );
    assert.equal(controller.getState().document, before);
  });

  test("rejects a section placed under a container that would otherwise structurally allow it", () => {
    // Every built-in container's `allowedChildTypes` is a closed list that
    // excludes "section" except "document-root" itself, so the ordinary
    // disallowed-child-type check already covers built-in nesting in the
    // default registry. Exercising the *separate* disallowed-parent-type
    // guard (section's own `allowedParentTypes: ["document-root"]`) needs a
    // container that would otherwise structurally permit "section" as a
    // child — replace "column" with one that does, via the registry's
    // explicit built-in-replacement path.
    const permissiveColumn: BlockDefinition = {
      ...DEFAULT_BUILDER_REGISTRIES.blocks.get("column")!,
      allowedChildTypes: [
        "heading",
        "rich-text",
        "image",
        "cta",
        "divider",
        "spacer",
        "section",
      ],
    };
    const blocks = createBlockRegistry(
      DEFAULT_BUILDER_REGISTRIES.blocks.list(),
      [permissiveColumn],
      {
        replace: ["column"],
      },
    );
    assert.equal(blocks.ok, true);
    if (!blocks.ok) return;
    const registries = createBuilderRegistries({
      blocks: blocks.value,
      modes: DEFAULT_BUILDER_REGISTRIES.modes,
      variables: DEFAULT_BUILDER_REGISTRIES.variables,
      inspectorControls: DEFAULT_BUILDER_REGISTRIES.inspectorControls,
    });
    assert.equal(registries.ok, true);
    if (!registries.ok) return;

    const controller = new BuilderController(createTestDocument(), {
      registries: registries.value,
    });
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    controller.dispatch({
      type: "insert-node",
      parentId: "columns-1",
      blockType: "column",
      nodeId: "col-a",
    });
    const before = controller.getState().document;

    const result = controller.dispatch({
      type: "insert-node",
      parentId: "col-a",
      blockType: "section",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "command/disallowed-parent-type",
      ),
    );
    assert.equal(controller.getState().document, before);
  });

  test("rejects inserting a block type that has no valid parent at all", () => {
    const unparentable: BlockDefinition = {
      type: "singleton-widget",
      version: 1,
      supportedModes: ["email", "landing-page"],
      isContainer: false,
      allowedParentTypes: null,
      allowedChildTypes: null,
      defaultProps: () => ({}),
      parseProps: () => ({ ok: true, value: {} }),
    };
    const permissiveSection: BlockDefinition = {
      ...DEFAULT_BUILDER_REGISTRIES.blocks.get("section")!,
      allowedChildTypes: [
        "heading",
        "rich-text",
        "image",
        "cta",
        "divider",
        "spacer",
        "columns",
        "singleton-widget",
      ],
    };
    const blocks = createBlockRegistry(
      DEFAULT_BUILDER_REGISTRIES.blocks.list(),
      [unparentable, permissiveSection],
      {
        replace: ["section"],
      },
    );
    assert.equal(blocks.ok, true);
    if (!blocks.ok) return;
    const registries = createBuilderRegistries({
      blocks: blocks.value,
      modes: DEFAULT_BUILDER_REGISTRIES.modes,
      variables: DEFAULT_BUILDER_REGISTRIES.variables,
      inspectorControls: DEFAULT_BUILDER_REGISTRIES.inspectorControls,
    });
    assert.equal(registries.ok, true);
    if (!registries.ok) return;

    const controller = new BuilderController(createTestDocument(), {
      registries: registries.value,
    });
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "singleton-widget",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "command/unparentable-block-type",
      ),
    );
  });
});

test.describe("BuilderController — update-columns", () => {
  test("changes the column count and widths atomically", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });

    const result = controller.dispatch({
      type: "update-columns",
      nodeId: "columns-1",
      columnWidthRatios: [40, 30, 20, 10],
    });
    assert.equal(result.ok, true);
    const columns = controller.getState().document.nodes["columns-1"];
    assert.equal(columns?.children?.length, 4);
    assert.deepEqual(
      (columns?.props as { columnWidthRatios: number[] }).columnWidthRatios,
      [40, 30, 20, 10],
    );

    assert.equal(controller.undo(), true);
    assert.equal(
      controller.getState().document.nodes["columns-1"]?.children?.length,
      2,
      "one undo restores the complete prior layout",
    );
  });

  test("moves authored content into the last retained column when reducing count", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    const originalColumnIds =
      controller.getState().document.nodes["columns-1"]?.children;
    assert.equal(originalColumnIds?.length, 2);
    const removedColumnId = originalColumnIds?.[1];
    assert.ok(removedColumnId);
    controller.dispatch({
      type: "insert-node",
      parentId: removedColumnId,
      blockType: "heading",
      nodeId: "preserved-heading",
    });

    const result = controller.dispatch({
      type: "update-columns",
      nodeId: "columns-1",
      columnWidthRatios: [100],
    });
    assert.equal(result.ok, true);
    const retainedColumnId =
      controller.getState().document.nodes["columns-1"]?.children?.[0];
    assert.ok(retainedColumnId);
    assert.deepEqual(
      controller.getState().document.nodes[retainedColumnId]?.children,
      ["preserved-heading"],
    );
    assert.equal(
      controller.getState().document.nodes[removedColumnId],
      undefined,
    );
    assert.ok(controller.getState().document.nodes["preserved-heading"]);
  });
});

test.describe("BuilderController — remove-node", () => {
  test("removes a node and its subtree, clearing selection if it was selected", () => {
    const controller = createTestController();
    controller.setSelection("heading-1");
    const result = controller.dispatch({
      type: "remove-node",
      nodeId: "heading-1",
    });
    assert.equal(result.ok, true);

    const state = controller.getState();
    assert.equal(state.document.nodes["heading-1"], undefined);
    assert.equal(state.transient.selectedNodeId, null);
    assert.deepEqual(state.document.nodes["section-1"].children, [
      "rich-text-1",
    ]);
  });

  test("removing an unrelated node does not clear an unrelated selection", () => {
    const controller = createTestController();
    controller.setSelection("rich-text-1");
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    assert.equal(controller.getState().transient.selectedNodeId, "rich-text-1");
  });

  test("rejects removing the document root", () => {
    const controller = createTestController();
    const result = controller.dispatch({ type: "remove-node", nodeId: "root" });
    assert.equal(result.ok, false);
  });

  test("rejects removing an individual column managed by a Columns block", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    const columnId =
      controller.getState().document.nodes["columns-1"]?.children?.[0];
    assert.ok(columnId);
    const result = controller.dispatch({
      type: "remove-node",
      nodeId: columnId,
    });
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.equal(result.issues[0]?.code, "command/cannot-remove-column");
  });
});

test.describe("BuilderController — move-node", () => {
  test("reorders siblings with one command", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "move-node",
      nodeId: "rich-text-1",
      newParentId: "section-1",
      index: 0,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(
      controller.getState().document.nodes["section-1"].children,
      ["rich-text-1", "heading-1"],
    );
  });

  test("prevents moving a container into its own descendant", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    controller.dispatch({
      type: "insert-node",
      parentId: "columns-1",
      blockType: "column",
      nodeId: "col-a",
    });

    const before = controller.getState().document;
    const result = controller.dispatch({
      type: "move-node",
      nodeId: "columns-1",
      newParentId: "col-a",
      index: 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.ok(result.issues.some((issue) => issue.code === "command/cycle"));
    assert.equal(controller.getState().document, before);
  });

  test("rejects moving the document root", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "move-node",
      nodeId: "root",
      newParentId: "section-1",
      index: 0,
    });
    assert.equal(result.ok, false);
  });

  test("allows column reordering only within its existing Columns block", () => {
    const controller = createTestController();
    for (const nodeId of ["columns-a", "columns-b"]) {
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "columns",
        nodeId,
      });
    }
    const columnsA = controller.getState().document.nodes["columns-a"]
      ?.children as string[];
    const columnsB = controller.getState().document.nodes["columns-b"]
      ?.children as string[];
    const [firstA, secondA] = columnsA;
    assert.ok(firstA && secondA && columnsB[0]);

    const reorder = controller.dispatch({
      type: "move-node",
      nodeId: firstA,
      newParentId: "columns-a",
      index: 1,
    });
    assert.equal(reorder.ok, true);
    assert.deepEqual(
      controller.getState().document.nodes["columns-a"]?.children,
      [secondA, firstA],
    );

    const reparent = controller.dispatch({
      type: "move-node",
      nodeId: firstA,
      newParentId: "columns-b",
      index: 0,
    });
    assert.equal(reparent.ok, false);
    if (!reparent.ok)
      assert.equal(reparent.issues[0]?.code, "command/cannot-reparent-column");
  });
});

test.describe("BuilderController — duplicate-node", () => {
  test("clones a leaf node with a regenerated ID and selects the clone", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "duplicate-node",
      nodeId: "heading-1",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const state = controller.getState();
    assert.deepEqual(state.document.nodes["section-1"].children, [
      "heading-1",
      result.selectedNodeId,
      "rich-text-1",
    ]);
    assert.equal(state.transient.selectedNodeId, result.selectedNodeId);
    const clone = state.document.nodes[result.selectedNodeId as string];
    const original = state.document.nodes["heading-1"];
    assert.deepEqual(
      (clone as { props: unknown }).props,
      (original as { props: unknown }).props,
    );
    assert.notEqual(result.selectedNodeId, "heading-1");
  });

  test("clones a container subtree preserving nested structure and order with all-new IDs", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    const originalColumnIds = [
      ...(controller.getState().document.nodes["columns-1"]?.children ?? []),
    ];
    const firstColumnId = originalColumnIds[0];
    assert.ok(firstColumnId);
    controller.dispatch({
      type: "insert-node",
      parentId: firstColumnId,
      blockType: "spacer",
      nodeId: "spacer-a",
    });

    const result = controller.dispatch({
      type: "duplicate-node",
      nodeId: "columns-1",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const { document } = controller.getState();
    const cloneRootId = result.selectedNodeId as string;
    const cloneRoot = document.nodes[cloneRootId];
    assert.equal(cloneRoot.children?.length, 2);
    const [cloneColA, cloneColB] = cloneRoot.children ?? [];
    assert.notEqual(cloneColA, originalColumnIds[0]);
    assert.notEqual(cloneColB, originalColumnIds[1]);
    assert.equal(document.nodes[cloneColA as string].children?.length, 1);
    assert.notEqual(
      document.nodes[cloneColA as string].children?.[0],
      "spacer-a",
    );
    // Original subtree is untouched.
    assert.deepEqual(document.nodes["columns-1"].children, originalColumnIds);
  });

  test("rejects duplicating the document root", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "duplicate-node",
      nodeId: "root",
    });
    assert.equal(result.ok, false);
  });

  test("rejects duplicating an individual column", () => {
    const controller = createTestController();
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "columns-1",
    });
    const columnId =
      controller.getState().document.nodes["columns-1"]?.children?.[0];
    assert.ok(columnId);
    const result = controller.dispatch({
      type: "duplicate-node",
      nodeId: columnId,
    });
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.equal(result.issues[0]?.code, "command/cannot-duplicate-column");
  });
});

test.describe("BuilderController — update-node-props / update-document-settings / update-rich-text", () => {
  test("update-node-props validates before commit and fails atomically on invalid input", () => {
    const controller = createTestController();
    const before = controller.getState().document;
    const result = controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: {
        level: 99,
        text: {
          kind: "donativus.rich-text",
          version: 1,
          children: [],
        },
        typography: {},
        spacing: {},
        align: "left",
      },
    });
    assert.equal(result.ok, false);
    assert.equal(controller.getState().document, before);
  });

  test("update-node-props commits a valid full props replacement", () => {
    const controller = createTestController();
    const current = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    const result = controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...current, level: 3 },
    });
    assert.equal(result.ok, true);
    assert.equal(
      (
        controller.getState().document.nodes["heading-1"].props as {
          level: number;
        }
      ).level,
      3,
    );
  });

  test("update-document-settings validates and commits", () => {
    const controller = createTestController();
    const current = controller.getState().document.settings as Record<
      string,
      unknown
    >;
    const result = controller.dispatch({
      type: "update-document-settings",
      settings: { ...current, previewText: "Updated preview" },
    });
    assert.equal(result.ok, true);
    assert.equal(
      (controller.getState().document.settings as { previewText: string })
        .previewText,
      "Updated preview",
    );
  });

  test("update-rich-text rejects a non-rich-text node", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "update-rich-text",
      nodeId: "heading-1",
      value: {},
    });
    assert.equal(result.ok, false);
  });

  test("update-rich-text validates and commits a new value", () => {
    const controller = createTestController();
    const result = controller.dispatch({
      type: "update-rich-text",
      nodeId: "rich-text-1",
      value: {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "center",
            children: [{ type: "text", text: "Updated", marks: [] }],
          },
        ],
      },
    });
    assert.equal(result.ok, true);
    const value = (
      controller.getState().document.nodes["rich-text-1"].props as {
        value: { children: unknown[] };
      }
    ).value;
    assert.equal(value.children.length, 1);
  });
});

test.describe("BuilderController — undo/redo", () => {
  test("one undo restores the previous order after a move", () => {
    const controller = createTestController();
    const original = controller.getState().document.nodes["section-1"].children;
    controller.dispatch({
      type: "move-node",
      nodeId: "rich-text-1",
      newParentId: "section-1",
      index: 0,
    });
    assert.notDeepEqual(
      controller.getState().document.nodes["section-1"].children,
      original,
    );

    const undone = controller.undo();
    assert.equal(undone, true);
    assert.deepEqual(
      controller.getState().document.nodes["section-1"].children,
      original,
    );
  });

  test("redo re-applies an undone command", () => {
    const controller = createTestController();
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    controller.undo();
    assert.ok(controller.getState().document.nodes["heading-1"]);
    controller.redo();
    assert.equal(controller.getState().document.nodes["heading-1"], undefined);
  });

  test("dispatching a new command after undo clears the redo stack", () => {
    const controller = createTestController();
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    controller.undo();
    assert.equal(controller.canRedo(), true);
    controller.dispatch({ type: "remove-node", nodeId: "rich-text-1" });
    assert.equal(controller.canRedo(), false);
  });

  test("undo/redo are no-ops at the boundaries", () => {
    const controller = createTestController();
    assert.equal(controller.undo(), false);
    assert.equal(controller.redo(), false);
  });

  test("a failed command does not create a history entry", () => {
    const controller = createTestController();
    controller.dispatch({ type: "remove-node", nodeId: "does-not-exist" });
    assert.equal(controller.canUndo(), false);
  });
});

test.describe("BuilderController — coalescing", () => {
  test("consecutive prop edits on the same node coalesce into one undo entry", () => {
    const controller = createTestController();
    const original = controller.getState().document;
    const base = original.nodes["heading-1"].props as Record<string, unknown>;

    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 2 },
    });
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 4 },
    });

    assert.equal(
      (
        controller.getState().document.nodes["heading-1"].props as {
          level: number;
        }
      ).level,
      4,
    );
    controller.undo();
    assert.equal(controller.getState().document, original);
  });

  test("edits to a different node do not coalesce with the previous run", () => {
    const controller = createTestController();
    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 2 },
    });

    const afterFirstEdit = controller.getState().document;
    const richTextProps = controller.getState().document.nodes["rich-text-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-rich-text",
      nodeId: "rich-text-1",
      value: richTextProps.value as object,
    });

    controller.undo();
    assert.equal(controller.getState().document, afterFirstEdit);
  });

  test("breakHistoryCoalescing forces the next matching edit into its own entry", () => {
    const controller = createTestController();
    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 2 },
    });
    const afterFirstEdit = controller.getState().document;

    controller.breakHistoryCoalescing();
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 3 },
    });

    controller.undo();
    assert.equal(controller.getState().document, afterFirstEdit);
  });

  test("a structural command always forms its own entry, never coalescing with prop edits", () => {
    const controller = createTestController();
    const base = controller.getState().document.nodes["heading-1"]
      .props as Record<string, unknown>;
    controller.dispatch({
      type: "update-node-props",
      nodeId: "heading-1",
      props: { ...base, level: 2 },
    });
    const afterPropEdit = controller.getState().document;

    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "spacer",
    });
    controller.undo();
    assert.equal(controller.getState().document, afterPropEdit);
    controller.undo();
    assert.equal(controller.getState().document.nodes["heading-1"].props, base);
  });
});

test.describe("BuilderController — history bounds", () => {
  test("undo depth is bounded — the oldest entries fall off once the ceiling is exceeded", () => {
    const controller = createTestController();
    const HISTORY_LIMIT = 100;
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "spacer",
      });
      controller.breakHistoryCoalescing();
    }
    let undoCount = 0;
    while (controller.undo()) undoCount += 1;
    assert.equal(undoCount, HISTORY_LIMIT);
  });
});

test.describe("BuilderController — loadDocument", () => {
  test("replacing the document resets transient state and clears history", () => {
    const controller = createTestController();
    controller.dispatch({ type: "remove-node", nodeId: "heading-1" });
    controller.setSelection("rich-text-1");
    assert.equal(controller.canUndo(), true);

    controller.loadDocument(createTestDocument());
    assert.equal(controller.canUndo(), false);
    assert.equal(controller.canRedo(), false);
    assert.equal(controller.getState().transient.selectedNodeId, null);
  });
});

test.describe("BuilderController — validate/export", () => {
  test("export returns canonical JSON and no HTML when the document is valid", () => {
    const controller = createTestController();
    const result = controller.export();
    assert.equal(result.errors.length, 0);
    assert.ok(result.json);
    assert.equal(result.html, null);
  });

  test("export reports a blocking issue for an unavailable node without discarding it", () => {
    const document = createTestDocument();
    const section = document.nodes["section-1"];
    const withUnavailable: VisualDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        "section-1": {
          ...section,
          children: [...(section.children ?? []), "plugin-1"],
        },
        "plugin-1": {
          id: "plugin-1",
          type: "third-party",
          version: 1,
          props: { foo: "bar" },
          unavailable: true,
        },
      },
    };
    const controller = new BuilderController(withUnavailable);
    const result = controller.export();
    assert.ok(
      result.errors.some(
        (issue) => issue.code === "document/unsupported-block",
      ),
    );
    assert.equal(result.json, null);
    assert.ok(controller.getState().document.nodes["plugin-1"]);
  });

  test("export reports a blocking issue when the document root is not a root-only block type", () => {
    const document = createTestDocument();
    const invalidRoot: VisualDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        root: { ...document.nodes.root, type: "section" as never },
      },
    };
    const controller = new BuilderController(invalidRoot);
    const result = controller.export();
    assert.ok(
      result.errors.some(
        (issue) => issue.code === "document/invalid-root-block-type",
      ),
    );
  });
});

test.describe("BuilderController — generated IDs vs. a reopened document", () => {
  function createSavedDocumentWithGeneratedIds(): VisualDocument {
    const authoring = new BuilderController(createTestDocument());
    const inserted = authoring.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
    });
    assert.equal(inserted.ok, true);
    const saved = authoring.getState().document;
    assert.ok(saved.nodes["node-1"], "the first session generated node-1");
    assert.ok(saved.nodes["node-3"], "and node-3 for its second column");
    return saved;
  }

  test("every column count change on a reopened block takes fresh IDs", () => {
    const saved = createSavedDocumentWithGeneratedIds();
    const storedIds = new Set(Object.keys(saved.nodes));
    const originalColumnIds = saved.nodes["node-1"]?.children ?? [];
    assert.equal(originalColumnIds.length, 2);
    const reopened = new BuilderController(saved);

    for (const ratios of [
      [34, 33, 33],
      [25, 25, 25, 25],
      [100],
      [50, 50],
    ]) {
      const result = reopened.dispatch({
        type: "update-columns",
        nodeId: "node-1",
        columnWidthRatios: ratios,
      });
      assert.equal(result.ok, true, `${ratios.length} columns was rejected`);

      const nodes = reopened.getState().document.nodes;
      const children = nodes["node-1"]?.children ?? [];
      assert.equal(children.length, ratios.length);
      assert.equal(new Set(children).size, ratios.length);
      for (const columnId of children) {
        assert.equal(nodes[columnId]?.type, "column");
        assert.ok(
          originalColumnIds.includes(columnId) || !storedIds.has(columnId),
          `column "${columnId}" took over an ID the saved document already used`,
        );
      }
      assert.equal(nodes["node-1"]?.type, "columns");
      assert.equal(nodes["heading-1"]?.type, "heading");
    }
  });

  test("inserting a block with default children into a reopened document keeps every stored node", () => {
    const saved = createSavedDocumentWithGeneratedIds();
    const storedIds = Object.keys(saved.nodes);
    const reopened = new BuilderController(saved);

    const result = reopened.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const nodes = reopened.getState().document.nodes;
    assert.equal(Object.keys(nodes).length, storedIds.length + 3);
    for (const storedId of storedIds) {
      if (storedId === "section-1") continue; // the parent legitimately gains a child
      assert.deepEqual(
        nodes[storedId],
        saved.nodes[storedId],
        `stored node "${storedId}" was overwritten by the insert`,
      );
    }
    assert.deepEqual(nodes["section-1"]?.children, [
      ...(saved.nodes["section-1"]?.children ?? []),
      result.selectedNodeId,
    ]);
  });

  test("a caller-supplied node ID is never handed to one of its own default children", () => {
    const controller = new BuilderController(createTestDocument());
    const result = controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "columns",
      nodeId: "node-2",
    });
    assert.equal(result.ok, true);

    const nodes = controller.getState().document.nodes;
    assert.equal(nodes["node-2"]?.type, "columns");
    const children = nodes["node-2"]?.children ?? [];
    assert.equal(children.length, 2);
    assert.equal(children.includes("node-2"), false);
    for (const columnId of children) {
      assert.equal(nodes[columnId]?.type, "column");
    }
  });

  test("duplicating a reopened block adds nodes instead of overwriting the originals", () => {
    const saved = createSavedDocumentWithGeneratedIds();
    const reopened = new BuilderController(saved);
    const before = Object.keys(saved.nodes).length;

    const result = reopened.dispatch({
      type: "duplicate-node",
      nodeId: "node-1",
    });
    assert.equal(result.ok, true);
    const nodes = reopened.getState().document.nodes;
    assert.equal(Object.keys(nodes).length, before + 3);
    assert.deepEqual(
      nodes["node-1"],
      saved.nodes["node-1"],
      "the source block is untouched by its own duplicate",
    );
  });
});
