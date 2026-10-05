import assert from "node:assert/strict";
import test from "node:test";
import { parseRichTextValue } from "./rich-text.js";

function valueWithRun(run: Record<string, unknown>): unknown {
  return {
    kind: "donativus.rich-text",
    version: 1,
    children: [
      {
        type: "paragraph",
        align: "left",
        children: [{ type: "text", text: "Valentina", marks: [], ...run }],
      },
    ],
  };
}

test("a text run keeps its own font family through parsing", () => {
  const fontFamily = '"Snell Roundhand", "Segoe Script", cursive';
  const result = parseRichTextValue(valueWithRun({ fontFamily }), "value");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const paragraph = result.value.children[0];
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type !== "paragraph") return;
  assert.deepEqual(paragraph.children[0], {
    type: "text",
    text: "Valentina",
    marks: [],
    fontFamily,
  });
});

test("a text run rejects an empty or oversized font family", () => {
  for (const fontFamily of ["", "a".repeat(201), 12]) {
    const result = parseRichTextValue(valueWithRun({ fontFamily }), "value");
    assert.equal(result.ok, false, String(fontFamily).slice(0, 12));
  }
});

test("a text run without a font family stores none", () => {
  const result = parseRichTextValue(valueWithRun({}), "value");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const paragraph = result.value.children[0];
  if (paragraph?.type !== "paragraph") return;
  assert.equal("fontFamily" in (paragraph.children[0] ?? {}), false);
});
