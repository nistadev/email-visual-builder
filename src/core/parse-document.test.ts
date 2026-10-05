import assert from "node:assert/strict";
import test from "node:test";
import { parseVisualDocument } from "./parse-document.js";
import { serializeVisualDocument } from "./serialize.js";
import {
  cloneAsJson,
  createValidEmailDocumentInput,
} from "../test-utils/visual-document-fixture.js";

test.describe("parseVisualDocument — valid input", () => {
  test("parses a valid email document", () => {
    const result = parseVisualDocument(createValidEmailDocumentInput());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.mode, "email");
    assert.equal(result.value.rootId, "root");
    assert.equal(Object.keys(result.value.nodes).length, 4);
  });

  test("round-trips: parse -> serialize -> parse produces an identical document", () => {
    const first = parseVisualDocument(createValidEmailDocumentInput());
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const json = serializeVisualDocument(first.value);
    const second = parseVisualDocument(JSON.parse(json));
    assert.equal(second.ok, true);
    if (!second.ok) return;

    assert.equal(serializeVisualDocument(second.value), json);
  });

  test("accepts input that has actually crossed a JSON boundary", () => {
    const result = parseVisualDocument(
      cloneAsJson(createValidEmailDocumentInput()),
    );
    assert.equal(result.ok, true);
  });

  test("measures input in browser-like runtimes where Node Buffer is unavailable", () => {
    const runtime = globalThis as typeof globalThis & {
      Buffer?: typeof Buffer;
    };
    const previousBuffer = runtime.Buffer;
    Reflect.deleteProperty(runtime, "Buffer");
    try {
      const result = parseVisualDocument(createValidEmailDocumentInput());
      assert.equal(result.ok, true);
      if (!result.ok) {
        assert.equal(
          result.issues.some(
            (candidate) => candidate.code === "document/unserializable",
          ),
          false,
        );
      }
    } finally {
      runtime.Buffer = previousBuffer;
    }
  });
});

test.describe("parseVisualDocument — malformed props", () => {
  test("reports a node/path-identified issue for an invalid enum value", () => {
    const input = createValidEmailDocumentInput();
    (input.nodes as Record<string, any>)["heading-1"].props.align = "diagonal";

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    const issue = result.issues.find((candidate) =>
      candidate.path?.includes("heading-1"),
    );
    assert.ok(issue, "expected an issue referencing the malformed node");
    assert.match(issue!.path ?? "", /align/);
  });

  test("collects issues from multiple independently-malformed fields at once", () => {
    const input = createValidEmailDocumentInput();
    (input.nodes as Record<string, any>)["heading-1"].props.align = "diagonal";
    (input.nodes as Record<string, any>)[
      "heading-1"
    ].props.typography.fontWeight = "extra-bold";

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.length >= 2,
      "expected issues for both malformed fields",
    );
  });

  test("rejects a document missing its root node", () => {
    const input = createValidEmailDocumentInput();
    input.rootId = "does-not-exist";

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/missing-root"),
    );
  });

  test("rejects a document that is not an object", () => {
    const result = parseVisualDocument("not a document");
    assert.equal(result.ok, false);
  });

  test("rejects an unknown document kind", () => {
    const input = createValidEmailDocumentInput();
    input.kind = "something-else";

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/invalid-kind"),
    );
  });
});

test.describe("parseVisualDocument — unavailable plugin nodes", () => {
  test("preserves a node whose type is not a registered built-in", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, any>;
    nodes["section-1"].children.push("custom-1");
    nodes["custom-1"] = {
      id: "custom-1",
      type: "third-party-widget",
      version: 1,
      props: { foo: "bar" },
    };

    const result = parseVisualDocument(input);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const preserved = result.value.nodes["custom-1"];
    assert.ok(
      preserved && "unavailable" in preserved && preserved.unavailable === true,
    );
    assert.deepEqual((preserved as { props: unknown }).props, { foo: "bar" });
  });
});
