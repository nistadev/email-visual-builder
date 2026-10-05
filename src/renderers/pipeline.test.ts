import assert from "node:assert/strict";
import test from "node:test";
import type { VariableDefinition } from "../types/index.js";
import { BuilderController } from "../core/controller/controller.js";
import { createBuilderRegistries } from "../core/registry/builder-registries.js";
import { createModeRegistry } from "../core/registry/mode-registry.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../core/registry/default-registries.js";
import { createVariableRegistry } from "../core/registry/variable-registry.js";
import { createStarterDocument } from "../core/starter-document.js";
import type {
  BuilderRegistries,
  ModeDefinition,
} from "../core/registry/types.js";
import {
  createValidEmailDocumentInput,
  cloneAsJson,
} from "../test-utils/visual-document-fixture.js";
import { exportVisualDocument } from "./pipeline.js";
import { DEFAULT_RENDERER_REGISTRIES } from "./registries.js";

function richText(text: string): Record<string, unknown> {
  return {
    kind: "donativus.rich-text",
    version: 1,
    children: [
      {
        type: "paragraph",
        align: "left",
        children: text ? [{ type: "text", text, marks: [] }] : [],
      },
    ],
  };
}

function registriesWithStubEmailRenderer(): BuilderRegistries {
  const emailMode = DEFAULT_BUILDER_REGISTRIES.modes.get(
    "email",
  ) as ModeDefinition;
  const landingMode = DEFAULT_BUILDER_REGISTRIES.modes.get(
    "landing-page",
  ) as ModeDefinition;
  const stubbedEmailMode: ModeDefinition = {
    ...emailMode,
    renderer: (document: unknown) =>
      `<html data-node-count="${Object.keys((document as { nodes: object }).nodes).length}"></html>`,
  };
  const modesResult = createModeRegistry([stubbedEmailMode, landingMode]);
  assert.equal(modesResult.ok, true);
  if (!modesResult.ok) throw new Error("unreachable");

  const combined = createBuilderRegistries({
    blocks: DEFAULT_BUILDER_REGISTRIES.blocks,
    modes: modesResult.value,
    variables: DEFAULT_BUILDER_REGISTRIES.variables,
    inspectorControls: DEFAULT_BUILDER_REGISTRIES.inspectorControls,
  });
  assert.equal(combined.ok, true);
  if (!combined.ok) throw new Error("unreachable");
  return combined.value;
}

function registriesWithVariables(
  definitions: readonly VariableDefinition[],
): BuilderRegistries {
  const variablesResult = createVariableRegistry(definitions);
  assert.equal(variablesResult.ok, true);
  if (!variablesResult.ok) throw new Error("unreachable");
  const registriesResult = createBuilderRegistries({
    blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
    modes: DEFAULT_RENDERER_REGISTRIES.modes,
    variables: variablesResult.value,
    inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
  });
  assert.equal(registriesResult.ok, true);
  if (!registriesResult.ok) throw new Error("unreachable");
  return registriesResult.value;
}

test.describe("exportVisualDocument — parse failure", () => {
  test("returns a null document/json/html with the parse issues when input is not a valid document", () => {
    const result = exportVisualDocument({ not: "a document" });
    assert.equal(result.document, null);
    assert.equal(result.json, null);
    assert.equal(result.html, null);
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.warnings, []);
  });
});

test.describe("exportVisualDocument — default registries", () => {
  test("an email document renders real standalone HTML by default", () => {
    const result = exportVisualDocument(createValidEmailDocumentInput());
    assert.notEqual(result.document, null);
    assert.notEqual(result.json, null);
    assert.deepEqual(result.errors, []);
    assert.match(result.html ?? "", /^<!doctype html><html lang="en">/);
    assert.match(result.html ?? "", /Thank you/);
    assert.match(result.html ?? "", /Every gift matters\./);
  });

  test("a landing-page document renders real standalone HTML by default", () => {
    const landingDocument = JSON.parse(
      JSON.stringify(createStarterDocument("landing-page")),
    );
    const result = exportVisualDocument(landingDocument);
    assert.notEqual(result.document, null);
    assert.notEqual(result.json, null);
    assert.deepEqual(result.errors, []);
    assert.match(result.html ?? "", /^<!doctype html><html lang="en">/);
  });

  test("exports in browser-like runtimes where Node Buffer is unavailable", () => {
    const runtime = globalThis as typeof globalThis & {
      Buffer?: typeof Buffer;
    };
    const previousBuffer = runtime.Buffer;
    Reflect.deleteProperty(runtime, "Buffer");
    try {
      const result = exportVisualDocument(createValidEmailDocumentInput());
      assert.deepEqual(result.errors, []);
      assert.notEqual(result.html, null);
    } finally {
      runtime.Buffer = previousBuffer;
    }
  });

  test("sample preview renders escaped text while canonical output retains exact variable tokens", () => {
    const variables: readonly VariableDefinition[] = [
      {
        key: "recipient.firstName",
        token: "%recipient.firstName%",
        label: "First name",
        sampleValue: "Ada <Admin>",
        allowedContexts: ["text"],
      },
    ];
    const registries = registriesWithVariables(variables);
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<
      string,
      { props: Record<string, unknown> }
    >;
    nodes["heading-1"]!.props.text = {
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
              token: "%recipient.firstName%",
            },
          ],
        },
      ],
    };

    const tokenResult = exportVisualDocument(input, registries);
    const sampleResult = exportVisualDocument(input, registries, {
      variablePreviewMode: "sample",
    });

    assert.deepEqual(tokenResult.errors, []);
    assert.match(tokenResult.html ?? "", /%recipient\.firstName%/);
    assert.deepEqual(sampleResult.errors, []);
    assert.match(sampleResult.html ?? "", /Ada &lt;Admin&gt;/);
    assert.doesNotMatch(sampleResult.html ?? "", /%recipient\.firstName%/);
    assert.match(sampleResult.json ?? "", /%recipient\.firstName%/);
    assert.doesNotMatch(sampleResult.json ?? "", /Ada <Admin>/);
  });

  for (const mode of ["email", "landing-page"] as const) {
    test(`renders nested columns in ${mode} output`, () => {
      const controller = new BuilderController(createStarterDocument(mode));
      const outerResult = controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "columns",
        nodeId: "outer-columns",
      });
      assert.equal(outerResult.ok, true);
      const firstColumnId =
        controller.getState().document.nodes["outer-columns"]?.children?.[0];
      assert.ok(firstColumnId);
      const nestedResult = controller.dispatch({
        type: "insert-node",
        parentId: firstColumnId,
        blockType: "columns",
        nodeId: "nested-columns",
      });
      assert.equal(nestedResult.ok, true);

      const result = exportVisualDocument(controller.getState().document);
      assert.deepEqual(result.errors, []);
      assert.notEqual(result.html, null);
      const layoutMarker =
        mode === "email" ? /role="presentation"/g : /display:grid/g;
      assert.ok((result.html?.match(layoutMarker) ?? []).length >= 2);
    });
  }
});

test.describe("exportVisualDocument — with a registered mode renderer", () => {
  const registries = registriesWithStubEmailRenderer();

  test("renders HTML only when there are no blocking errors", () => {
    const result = exportVisualDocument(
      createValidEmailDocumentInput(),
      registries,
    );
    assert.deepEqual(result.errors, []);
    assert.notEqual(result.html, null);
    assert.match(result.html as string, /^<html data-node-count="4"><\/html>$/);
  });

  test("suppresses html when a blocking error exists (unavailable plugin block)", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    (nodes["section-1"] as { children: string[] }).children.push("mystery-1");
    nodes["mystery-1"] = {
      id: "mystery-1",
      type: "mystery-block",
      version: 1,
      props: {},
    };

    const result = exportVisualDocument(input, registries);
    assert.ok(
      result.errors.some(
        (issue) => issue.code === "document/unsupported-block",
      ),
    );
    assert.equal(result.html, null);
    assert.notEqual(result.document, null);
    assert.notEqual(result.json, null);
  });

  test("repeated exports of the same document produce byte-identical json and html", () => {
    const input = createValidEmailDocumentInput();
    const first = exportVisualDocument(cloneAsJson(input), registries);
    const second = exportVisualDocument(cloneAsJson(input), registries);
    assert.equal(first.json, second.json);
    assert.equal(first.html, second.html);
  });

  test("a document with an unsafe CTA destination is blocked with a node-identified error and no html", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    (nodes["section-1"] as { children: string[] }).children.push("cta-1");
    nodes["cta-1"] = {
      id: "cta-1",
      type: "cta",
      version: 1,
      props: {
        label: richText("Click"),
        destination: {
          segments: [{ kind: "literal", value: "javascript:alert(1)" }],
        },
        typography: {
          fontFamily: "Arial, sans-serif",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "bold",
          color: "#ffffff",
        },
        backgroundColor: "#000000",
        align: "left",
        width: { unit: "auto" },
        borderRadiusPx: 4,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        shadow: null,
      },
    };

    const result = exportVisualDocument(input, registries);
    assert.equal(result.html, null);
    assert.ok(
      result.errors.some(
        (issue) =>
          issue.code === "value/disallowed-url-scheme" &&
          issue.nodeId === "cta-1",
      ),
    );
  });

  test("a document with an unsafe image source is blocked before HTML rendering", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    (nodes["section-1"] as { children: string[] }).children.push("image-1");
    nodes["image-1"] = {
      id: "image-1",
      type: "image",
      version: 1,
      props: {
        asset: {
          url: "javascript:alert(1)",
          filename: "unsafe.svg",
          mimeType: "image/svg+xml",
        },
        altText: "Unsafe image",
        displayWidth: { unit: "percent", value: 100 },
        align: "left",
        link: null,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
    };

    const result = exportVisualDocument(input, registries);
    assert.equal(result.html, null);
    assert.ok(
      result.errors.some(
        (issue) =>
          issue.code === "value/disallowed-url-scheme" &&
          issue.nodeId === "image-1",
      ),
    );
  });

  test("a document with only quality-warning-level issues still renders html", () => {
    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, unknown>;
    (nodes["section-1"] as { children: string[] }).children.push("cta-empty");
    nodes["cta-empty"] = {
      id: "cta-empty",
      type: "cta",
      version: 1,
      props: {
        label: richText(""),
        destination: { segments: [] },
        typography: {
          fontFamily: "Arial, sans-serif",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "bold",
          color: "#ffffff",
        },
        backgroundColor: "#000000",
        align: "left",
        width: { unit: "auto" },
        borderRadiusPx: 4,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        shadow: null,
      },
    };

    const result = exportVisualDocument(input, registries);
    assert.deepEqual(result.errors, []);
    assert.notEqual(result.html, null);
    assert.ok(
      result.warnings.some(
        (warning) => warning.code === "quality/empty-cta-destination",
      ),
    );
    assert.ok(
      result.warnings.some(
        (warning) => warning.code === "document/missing-unsubscribe-link",
      ),
    );
  });
});
