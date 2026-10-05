import assert from "node:assert/strict";
import test from "node:test";
import type { RichTextValue, VisualDocument } from "../../types/index.js";
import { parseVisualDocument } from "../../core/parse-document.js";
import { BuilderController } from "../../core/controller/controller.js";
import { createIdGenerator } from "../../core/controller/id-generator.js";
import { createValidEmailDocumentInput } from "../../test-utils/visual-document-fixture.js";
import { createRichTextCommitHandler } from "./controller-commit.js";

function createTestController(): BuilderController {
  const parsed = parseVisualDocument(createValidEmailDocumentInput());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("fixture failed to parse");
  return new BuilderController(parsed.value as VisualDocument, {
    generateId: createIdGenerator("test"),
  });
}

test.describe("createRichTextCommitHandler (task 11.6)", () => {
  test("dispatches an update-rich-text command carrying the committed AST", () => {
    const controller = createTestController();
    const handler = createRichTextCommitHandler(controller, "rich-text-1");

    const nextValue: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "center",
          children: [{ type: "text", text: "Updated", marks: ["bold"] }],
        },
      ],
    };
    handler(nextValue);

    const node = controller.getState().document.nodes["rich-text-1"];
    assert.ok(node && !("unavailable" in node));
    assert.equal(node?.type, "rich-text");
    assert.deepEqual(
      node && "props" in node
        ? (node.props as { value: RichTextValue }).value
        : undefined,
      nextValue,
    );
  });

  test("consecutive commits to the same node coalesce into one undo step", () => {
    const controller = createTestController();
    const handler = createRichTextCommitHandler(controller, "rich-text-1");

    handler({
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [{ type: "text", text: "A", marks: [] }],
        },
      ],
    });
    handler({
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [{ type: "text", text: "AB", marks: [] }],
        },
      ],
    });
    handler({
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [{ type: "text", text: "ABC", marks: [] }],
        },
      ],
    });

    assert.equal(controller.canUndo(), true);
    controller.undo();
    const node = controller.getState().document.nodes["rich-text-1"];
    // One coalesced undo step reverts all three keystroke-like commits back to the pre-commit content.
    assert.ok(node && !("unavailable" in node) && node.type === "rich-text");
    const value =
      node && "props" in node
        ? (node.props as { value: RichTextValue }).value
        : undefined;
    assert.notDeepEqual(value?.children[0], {
      type: "paragraph",
      align: "left",
      children: [{ type: "text", text: "ABC", marks: [] }],
    });
  });
});
