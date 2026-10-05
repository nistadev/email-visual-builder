import assert from "node:assert/strict";
import test from "node:test";
import type { RichTextValue, VariableDefinition } from "../../types/index.js";
import { $nodesOfType, createEditor } from "lexical";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { createVariableRegistry } from "../../core/registry/variable-registry.js";
import type { VariableRegistry } from "../../core/registry/types.js";
import {
  installJsdomGlobals,
  type JsdomHandle,
} from "../../test-utils/index.js";
import { $populateEditorFromRichTextValue } from "./convert-from-ast.js";
import { $readRichTextValueFromEditor } from "./convert-to-ast.js";
import { InvalidVariableTextNode } from "./invalid-variable-text-node.js";
import { VariableNode } from "./variable-node.js";

let jsdom: JsdomHandle;

test.describe("rich-text AST <-> Lexical conversion (task 11.2/11.7)", () => {
  test.before(() => {
    jsdom = installJsdomGlobals();
  });
  test.after(async () => {
    await jsdom.cleanup();
  });

  const RECIPIENT_NAME: VariableDefinition = {
    key: "recipient.firstName",
    token: "%recipient.firstName%",
    label: "First name",
    sampleValue: "Alex",
    allowedContexts: ["text"],
  };
  const DONATE_URL: VariableDefinition = {
    key: "donate.url",
    token: "%donate.url%",
    label: "Donate link",
    allowedContexts: ["url"],
  };

  function requireRegistry(): VariableRegistry {
    const result = createVariableRegistry([RECIPIENT_NAME, DONATE_URL]);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("unreachable");
    return result.value;
  }

  function roundTrip(
    value: RichTextValue,
    registry: VariableRegistry,
  ): RichTextValue {
    const editor = createEditor({
      nodes: [
        ListNode,
        ListItemNode,
        LinkNode,
        VariableNode,
        InvalidVariableTextNode,
      ],
      onError: (error) => {
        throw error;
      },
    });
    editor.update(() => $populateEditorFromRichTextValue(value, registry), {
      discrete: true,
    });
    let result!: RichTextValue;
    editor.getEditorState().read(() => {
      result = $readRichTextValueFromEditor(registry);
    });
    return result;
  }

  test("formatted paragraphs, marks, and line breaks round-trip", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "center",
          children: [
            { type: "text", text: "Bold", marks: ["bold"] },
            {
              type: "text",
              text: " italic-underline",
              marks: ["italic", "underline"],
              color: "#ff0000",
            },
            { type: "break" },
            {
              type: "text",
              text: "highlighted",
              marks: [],
              highlightColor: "#fff3cd",
            },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("ordered and unordered lists round-trip", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "bulleted-list",
          children: [
            {
              type: "list-item",
              children: [{ type: "text", text: "First", marks: [] }],
            },
            {
              type: "list-item",
              children: [
                { type: "text", text: "Second", marks: ["strikethrough"] },
              ],
            },
          ],
        },
        {
          type: "numbered-list",
          children: [
            {
              type: "list-item",
              children: [{ type: "text", text: "Step one", marks: [] }],
            },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("a link with a literal destination round-trips", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "link",
              destination: {
                segments: [
                  { kind: "literal", value: "https://example.com/donate" },
                ],
              },
              children: [{ type: "text", text: "Donate", marks: ["bold"] }],
            },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("a link with a variable destination preserves the exact token", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "link",
              destination: {
                segments: [
                  {
                    kind: "variable",
                    variableKey: "donate.url",
                    token: "%donate.url%",
                  },
                ],
              },
              children: [{ type: "text", text: "Donate", marks: [] }],
            },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("a valid recipient variable node behaves as one token and round-trips exactly", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            { type: "text", text: "Hi ", marks: [] },
            {
              type: "variable",
              variableKey: "recipient.firstName",
              token: "%recipient.firstName%",
            },
            { type: "text", text: "!", marks: [] },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("a restored variable node whose token no longer matches the registry is marked unresolved but still round-trips its AST content", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "variable",
              variableKey: "recipient.firstName",
              token: "%stale.token%",
            },
          ],
        },
      ],
    };
    // The AST itself round-trips (core validation, not this adapter, is what blocks export on the mismatch).
    assert.deepEqual(roundTrip(value, registry), value);

    const editor = createEditor({
      nodes: [
        ListNode,
        ListItemNode,
        LinkNode,
        VariableNode,
        InvalidVariableTextNode,
      ],
      onError: (error) => {
        throw error;
      },
    });
    editor.update(() => $populateEditorFromRichTextValue(value, registry), {
      discrete: true,
    });
    editor.getEditorState().read(() => {
      const [variableNode] = $nodesOfType(VariableNode);
      assert.ok(variableNode);
      assert.equal(variableNode?.__resolved, false);
    });
  });

  test("an unknown variable key produces an unresolved node", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "variable",
              variableKey: "not.registered",
              token: "%not.registered%",
            },
          ],
        },
      ],
    };
    const editor = createEditor({
      nodes: [
        ListNode,
        ListItemNode,
        LinkNode,
        VariableNode,
        InvalidVariableTextNode,
      ],
      onError: (error) => {
        throw error;
      },
    });
    editor.update(() => $populateEditorFromRichTextValue(value, registry), {
      discrete: true,
    });
    editor.getEditorState().read(() => {
      const [variableNode] = $nodesOfType(VariableNode);
      assert.ok(variableNode);
      assert.equal(variableNode?.__resolved, false);
    });
  });

  test("an empty document round-trips to a single empty paragraph", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [],
    };
    const result = roundTrip(value, registry);
    assert.deepEqual(result, {
      kind: "donativus.rich-text",
      version: 1,
      children: [{ type: "paragraph", align: "left", children: [] }],
    });
  });
  test("a run's color and catalogue font round-trip", () => {
    const registry = requireRegistry();
    const value: RichTextValue = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "text",
              text: "Valentina",
              marks: [],
              color: "#e75480",
              fontFamily:
                '"Snell Roundhand", "Edwardian Script ITC", "Segoe Script", cursive',
            },
            { type: "text", text: " a trecut", marks: [] },
          ],
        },
      ],
    };
    assert.deepEqual(roundTrip(value, registry), value);
  });

  test("a font outside the catalogue never reaches the committed AST", () => {
    const registry = requireRegistry();
    const result = roundTrip(
      {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "left",
            children: [
              {
                type: "text",
                text: "pasted",
                marks: [],
                fontFamily: "Wingdings, fantasy",
              },
            ],
          },
        ],
      },
      registry,
    );
    assert.deepEqual(result.children, [
      {
        type: "paragraph",
        align: "left",
        children: [{ type: "text", text: "pasted", marks: [] }],
      },
    ]);
  });
});
