import assert from "node:assert/strict";
import test from "node:test";
import { buildTreeIndex } from "./tree.js";
import type { VisualBuilderNodeRecord } from "../types/index.js";

function leaf(
  id: string,
  children?: string[],
): VisualBuilderNodeRecord[string] {
  return {
    id,
    type: "spacer",
    version: 1,
    props: { heightPx: 8 },
    ...(children ? { children } : {}),
  };
}

test.describe("buildTreeIndex", () => {
  test("accepts a valid tree and derives parent pointers", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root", ["a", "b"]),
      a: leaf("a"),
      b: leaf("b", ["c"]),
      c: leaf("c"),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.parentOf.root, null);
    assert.equal(result.value.parentOf.a, "root");
    assert.equal(result.value.parentOf.b, "root");
    assert.equal(result.value.parentOf.c, "b");
    assert.equal(result.value.reachableNodeIds.size, 4);
  });

  test("rejects a missing root", () => {
    const result = buildTreeIndex("root", { other: leaf("other") });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/missing-root"),
    );
  });

  test("rejects a node referenced as a child by two different parents", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root", ["a", "b"]),
      a: leaf("a", ["shared"]),
      b: leaf("b", ["shared"]),
      shared: leaf("shared"),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/duplicate-ownership",
      ),
    );
  });

  test("rejects a node listing the same child twice", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root", ["a", "a"]),
      a: leaf("a"),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/duplicate-child"),
    );
  });

  test("rejects a node that lists itself as a child", () => {
    const nodes: VisualBuilderNodeRecord = { root: leaf("root", ["root"]) };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/self-referential-node",
      ),
    );
  });

  test("rejects a child reference to a node that does not exist", () => {
    const nodes: VisualBuilderNodeRecord = { root: leaf("root", ["ghost"]) };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/missing-child-reference",
      ),
    );
  });

  test("rejects an orphan node unreachable from root", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root"),
      orphan: leaf("orphan"),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.code === "document/orphan-node" && issue.nodeId === "orphan",
      ),
    );
  });

  test("rejects a two-node cycle disconnected from root", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root"),
      a: leaf("a", ["b"]),
      b: leaf("b", ["a"]),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "document/cycle"));
  });

  test("rejects the root being listed as another node's child", () => {
    const nodes: VisualBuilderNodeRecord = {
      root: leaf("root"),
      a: leaf("a", ["root"]),
    };
    const result = buildTreeIndex("root", nodes);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "document/root-has-parent"),
    );
  });
});
