import assert from "node:assert/strict";
import test from "node:test";
import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { preflightVisualDocument } from "./preflight.js";
import { parseHexColor, parseFiniteNumber, parseString } from "./primitives.js";
import { parseSpacing, parseWidth } from "./parse/presentation.js";
import { parseNodeMap } from "./parse/node-map.js";
import { parseRichTextValue } from "./parse/rich-text.js";
import { DEFAULT_BUILDER_REGISTRIES } from "./registry/default-registries.js";
import { createValidEmailDocumentInput } from "../test-utils/visual-document-fixture.js";

test.describe("limit boundaries — preflight", () => {
  test("accepts a document at the node-count ceiling", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    const rootChildren: string[] = (nodes.root as { children: string[] })
      .children;
    for (
      let index = 0;
      Object.keys(nodes).length < VISUAL_DOCUMENT_LIMITS.maxNodeCount;
      index += 1
    ) {
      const id = `extra-${index}`;
      nodes[id] = { id, type: "spacer", version: 1, props: { heightPx: 4 } };
      rootChildren.push(id);
    }
    assert.equal(
      Object.keys(nodes).length,
      VISUAL_DOCUMENT_LIMITS.maxNodeCount,
    );
    const result = preflightVisualDocument(input);
    assert.equal(result.ok, true);
  });

  test("rejects a document exceeding the node-count ceiling", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    for (
      let index = 0;
      Object.keys(nodes).length <= VISUAL_DOCUMENT_LIMITS.maxNodeCount;
      index += 1
    ) {
      const id = `extra-${index}`;
      nodes[id] = { id, type: "spacer", version: 1, props: { heightPx: 4 } };
    }
    const result = preflightVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/too-many-nodes"),
    );
  });

  test("rejects input exceeding the byte-size ceiling", () => {
    const input = createValidEmailDocumentInput();
    (input.settings as Record<string, unknown>).previewText = "x".repeat(
      VISUAL_DOCUMENT_LIMITS.maxInputBytes + 1,
    );

    const result = preflightVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/input-too-large"),
    );
  });

  test("rejects a node whose props nest deeper than the depth ceiling", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, any>;
    let deeplyNested: unknown = "bottom";
    for (
      let depth = 0;
      depth < VISUAL_DOCUMENT_LIMITS.maxDepth + 5;
      depth += 1
    ) {
      deeplyNested = { nested: deeplyNested };
    }
    nodes["heading-1"].props.pathological = deeplyNested;

    const result = preflightVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/node-too-complex"),
    );
  });
});

test.describe("limit boundaries — node children", () => {
  test("rejects a node with more children than the ceiling", () => {
    const children = Array.from(
      { length: VISUAL_DOCUMENT_LIMITS.maxChildrenPerNode + 1 },
      (_, index) => `c${index}`,
    );
    const nodes: Record<string, unknown> = {
      root: {
        id: "root",
        type: "section",
        version: 1,
        children,
        props: {
          background: { color: null },
          contentWidth: { unit: "px", value: 600 },
          spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
          align: "left",
          shadow: null,
        },
      },
    };
    for (const id of children) {
      nodes[id] = { id, type: "spacer", version: 1, props: { heightPx: 4 } };
    }
    const result = parseNodeMap(
      nodes,
      "nodes",
      DEFAULT_BUILDER_REGISTRIES.blocks,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/too-many-children",
      ),
    );
  });
});

test.describe("limit boundaries — scalar values", () => {
  test("parseString accepts the maximum length and rejects one over it", () => {
    const atLimit = "a".repeat(10);
    assert.equal(parseString(atLimit, "field", { maxLength: 10 }).ok, true);
    assert.equal(
      parseString(atLimit + "a", "field", { maxLength: 10 }).ok,
      false,
    );
  });

  test("parseFiniteNumber accepts the boundary and rejects one past it", () => {
    assert.equal(parseFiniteNumber(10, "field", { min: 0, max: 10 }).ok, true);
    assert.equal(
      parseFiniteNumber(10.0001, "field", { min: 0, max: 10 }).ok,
      false,
    );
    assert.equal(
      parseFiniteNumber(-0.0001, "field", { min: 0, max: 10 }).ok,
      false,
    );
  });

  test("parseSpacing rejects a value beyond the documented spacing ceiling", () => {
    const result = parseSpacing(
      {
        topPx: VISUAL_DOCUMENT_LIMITS.maxSpacingPx + 1,
        rightPx: 0,
        bottomPx: 0,
        leftPx: 0,
      },
      "spacing",
    );
    assert.equal(result.ok, false);
  });

  test("parseWidth rejects a percent value beyond 100", () => {
    const result = parseWidth({ unit: "percent", value: 101 }, "width");
    assert.equal(result.ok, false);
  });

  test("parseWidth rejects a px value beyond the documented dimension ceiling", () => {
    const result = parseWidth(
      { unit: "px", value: VISUAL_DOCUMENT_LIMITS.maxDimensionPx + 1 },
      "width",
    );
    assert.equal(result.ok, false);
  });

  test("parseHexColor accepts 6- and 8-digit hex and rejects malformed values", () => {
    assert.equal(parseHexColor("#aabbcc", "color").ok, true);
    assert.equal(parseHexColor("#aabbccdd", "color").ok, true);
    assert.equal(parseHexColor("red", "color").ok, false);
    assert.equal(parseHexColor("#abc", "color").ok, false);
    assert.equal(parseHexColor("javascript:alert(1)", "color").ok, false);
  });
});

test.describe("limit boundaries — rich text", () => {
  test("accepts hex text colors and rejects CSS expressions", () => {
    const base = {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "text",
              text: "Safe text",
              marks: [],
              color: "#112233",
              highlightColor: "#ffee0080",
            },
          ],
        },
      ],
    };
    assert.equal(parseRichTextValue(base, "value").ok, true);
    const unsafe = structuredClone(base);
    unsafe.children[0]!.children[0]!.color = "expression(alert(1))";
    assert.equal(parseRichTextValue(unsafe, "value").ok, false);
  });

  test("rejects a rich-text value larger than the documented byte ceiling", () => {
    // Many paragraphs, each under the per-string length ceiling, whose
    // combined size still exceeds the rich-text-value ceiling.
    const paragraphText = "x".repeat(
      VISUAL_DOCUMENT_LIMITS.maxStringLength - 1,
    );
    const paragraphCount = Math.ceil(
      (VISUAL_DOCUMENT_LIMITS.maxRichTextBytes * 1.5) / paragraphText.length,
    );
    const value = {
      kind: "donativus.rich-text",
      version: 1,
      children: Array.from({ length: paragraphCount }, () => ({
        type: "paragraph",
        align: "left",
        children: [{ type: "text", text: paragraphText, marks: [] }],
      })),
    };
    const result = parseRichTextValue(value, "value");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "value/rich-text-too-large"),
    );
  });
});
