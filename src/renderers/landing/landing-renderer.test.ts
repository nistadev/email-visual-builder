import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { VariableDefinition } from "../../types/index.js";
import { createBuilderRegistries } from "../../core/registry/builder-registries.js";
import { createVariableRegistry } from "../../core/registry/variable-registry.js";
import { createStarterDocument } from "../../core/starter-document.js";
import type { BuilderRegistries } from "../../core/registry/types.js";
import { exportVisualDocument } from "../pipeline.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../registries.js";
import { renderRichTextInlineHtml } from "./rich-text-html.js";

const DONATE_URL: VariableDefinition = {
  key: "donate.url",
  token: "%donate.url%",
  label: "Donate link",
  allowedContexts: ["url"],
};

function registriesWithVariables(): BuilderRegistries {
  const variables = createVariableRegistry([DONATE_URL]);
  assert.equal(variables.ok, true);
  if (!variables.ok) throw new Error("unreachable");
  const combined = createBuilderRegistries({
    blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
    modes: DEFAULT_RENDERER_REGISTRIES.modes,
    variables: variables.value,
    inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
  });
  assert.equal(combined.ok, true);
  if (!combined.ok) throw new Error("unreachable");
  return combined.value;
}

const TYPOGRAPHY = {
  fontFamily: "Arial, sans-serif",
  fontSizePx: 16,
  lineHeightPercent: 150,
  letterSpacingPx: 0,
  fontWeight: "normal" as const,
  color: "#333333",
};
const SPACING = { topPx: 8, rightPx: 0, bottomPx: 8, leftPx: 0 };

function richText(text: string): Record<string, unknown> {
  return {
    kind: "donativus.rich-text",
    version: 1,
    children: [
      {
        type: "paragraph",
        align: "left",
        children: [{ type: "text", text, marks: [] }],
      },
    ],
  };
}

function expectRender(
  input: Record<string, unknown>,
  registries: BuilderRegistries = DEFAULT_RENDERER_REGISTRIES,
) {
  const result = exportVisualDocument(input, registries);
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors));
  assert.notEqual(result.html, null, "expected html to be rendered");
  return result.html as string;
}

test.describe("landing renderer — metadata", () => {
  test("a starter document renders language, title, and viewport metadata with no meta description or favicon", () => {
    const html = expectRender(
      JSON.parse(JSON.stringify(createStarterDocument("landing-page"))),
    );
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>Untitled page<\/title>/);
    assert.match(
      html,
      /<meta name="viewport" content="width=device-width, initial-scale=1">/,
    );
    assert.doesNotMatch(html, /name="description"/);
    assert.doesNotMatch(html, /rel="icon"/);
  });

  test("meta description and favicon render when configured", () => {
    const input = JSON.parse(
      JSON.stringify(createStarterDocument("landing-page")),
    ) as Record<string, unknown>;
    (input.settings as Record<string, unknown>).metaDescription =
      "Support our mission this year.";
    (input.settings as Record<string, unknown>).faviconUrl =
      "https://cdn.example.com/favicon.png";
    const html = expectRender(input);
    assert.match(
      html,
      /<meta name="description" content="Support our mission this year\.">/,
    );
    assert.match(
      html,
      /<link rel="icon" href="https:\/\/cdn\.example\.com\/favicon\.png">/,
    );
  });

  test("document content width and alignment style the main container", () => {
    const document = createStarterDocument("landing-page");
    document.settings.contentWidth = { unit: "px", value: 840 };
    document.settings.contentAlign = "left";
    const html = expectRender(JSON.parse(JSON.stringify(document)));

    assert.match(
      html,
      /<main style="width:100%;max-width:840px;margin-left:0;margin-right:auto;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;">/,
    );
  });
});

test.describe("landing renderer — variables", () => {
  test("a CTA destination built from a URL-context variable preserves its exact token", () => {
    const input = {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "landing-page",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "document-root",
          version: 1,
          children: ["section-1"],
          props: {},
        },
        "section-1": {
          id: "section-1",
          type: "section",
          version: 1,
          children: ["cta-1"],
          props: {
            background: { color: null },
            contentWidth: { unit: "px", value: 960 },
            spacing: SPACING,
            align: "left",
            shadow: null,
          },
        },
        "cta-1": {
          id: "cta-1",
          type: "cta",
          version: 1,
          props: {
            label: richText("Donate"),
            destination: {
              segments: [
                {
                  kind: "variable",
                  variableKey: "donate.url",
                  token: "%donate.url%",
                },
              ],
            },
            typography: TYPOGRAPHY,
            backgroundColor: "#000000",
            align: "left",
            width: { unit: "auto" },
            borderRadiusPx: 0,
            spacing: SPACING,
            shadow: null,
          },
        },
      },
      settings: {
        language: "en",
        title: "Test",
        metaDescription: null,
        pageBackgroundColor: "#ffffff",
        contentWidth: { unit: "px", value: 960 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
        faviconUrl: null,
      },
    };
    const html = expectRender(input, registriesWithVariables());
    assert.match(html, /href="%donate\.url%"/);
    // A destination built from a variable can't be classified as external at render time — no target/rel.
    assert.doesNotMatch(html, /target="_blank"/);
  });
});

test.describe("landing renderer — columns", () => {
  function documentWithColumns(
    count: number,
    responsiveStack: "stack" | "no-stack",
  ) {
    const columnIds = Array.from(
      { length: count },
      (_, index) => `col-${index}`,
    );
    const ratio = Math.floor(100 / count);
    const ratios = columnIds.map((_, index) =>
      index === count - 1 ? 100 - ratio * (count - 1) : ratio,
    );
    const columns: Record<string, unknown> = {};
    for (const columnId of columnIds) {
      columns[columnId] = {
        id: columnId,
        type: "column",
        version: 1,
        children: [],
        props: { background: { color: null }, spacing: SPACING },
      };
    }
    return {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "landing-page",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "document-root",
          version: 1,
          children: ["section-1"],
          props: {},
        },
        "section-1": {
          id: "section-1",
          type: "section",
          version: 1,
          children: ["columns-1"],
          props: {
            background: { color: "#ffffff" },
            contentWidth: { unit: "px", value: 960 },
            spacing: SPACING,
            align: "center",
            shadow: null,
          },
        },
        "columns-1": {
          id: "columns-1",
          type: "columns",
          version: 1,
          children: columnIds,
          props: {
            columnWidthRatios: ratios,
            responsiveStack,
            spacing: SPACING,
          },
        },
        ...columns,
      },
      settings: {
        language: "en",
        title: "Test page",
        metaDescription: null,
        pageBackgroundColor: "#ffffff",
        contentWidth: { unit: "px", value: 960 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
        faviconUrl: null,
      },
    };
  }

  test("a responsive columns block renders a CSS grid with a deterministic stacking media rule", () => {
    const html = expectRender(documentWithColumns(3, "stack"));
    assert.match(html, /grid-template-columns:33fr 33fr 34fr/);
    assert.match(
      html,
      /@media \(max-width:600px\)\{\.vb-grid-0\{grid-template-columns:1fr !important;\}\}/,
    );
  });

  test("a non-stacking columns block renders no media rule", () => {
    const html = expectRender(documentWithColumns(2, "no-stack"));
    assert.doesNotMatch(html, /@media/);
  });
});

test.describe("landing renderer — every built-in block and external-link policy", () => {
  function fullDocument(): Record<string, unknown> {
    return {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "landing-page",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "document-root",
          version: 1,
          children: ["section-1"],
          props: {},
        },
        "section-1": {
          id: "section-1",
          type: "section",
          version: 1,
          children: [
            "heading-1",
            "rich-text-1",
            "image-1",
            "cta-external",
            "cta-relative",
            "divider-1",
            "spacer-1",
          ],
          props: {
            background: { color: "#ffffff" },
            contentWidth: { unit: "px", value: 960 },
            spacing: SPACING,
            margin: {
              topPx: 2,
              rightPx: 3,
              bottomPx: 4,
              leftPx: 5,
            },
            align: "center",
            shadow: {
              offsetXPx: 0,
              offsetYPx: 7,
              blurPx: 21,
              spreadPx: 0,
              color: "#00000033",
            },
          },
        },
        "heading-1": {
          id: "heading-1",
          type: "heading",
          version: 1,
          props: {
            level: 1,
            text: richText("Join the campaign"),
            typography: { ...TYPOGRAPHY, fontSizePx: 32, fontWeight: "bold" },
            spacing: SPACING,
            align: "center",
          },
        },
        "rich-text-1": {
          id: "rich-text-1",
          type: "rich-text",
          version: 1,
          props: {
            value: {
              kind: "donativus.rich-text",
              version: 1,
              children: [
                {
                  type: "paragraph",
                  align: "center",
                  children: [
                    { type: "text", text: "Sign the ", marks: [] },
                    {
                      type: "link",
                      destination: {
                        segments: [
                          {
                            kind: "literal",
                            value: "https://forms.example.com/sign",
                          },
                        ],
                      },
                      children: [
                        { type: "text", text: "external form", marks: [] },
                      ],
                    },
                    { type: "text", text: " or see our ", marks: [] },
                    {
                      type: "link",
                      destination: {
                        segments: [{ kind: "literal", value: "#faq" }],
                      },
                      children: [{ type: "text", text: "FAQ", marks: [] }],
                    },
                    { type: "text", text: ".", marks: [] },
                  ],
                },
              ],
            },
            typography: TYPOGRAPHY,
            spacing: SPACING,
          },
        },
        "image-1": {
          id: "image-1",
          type: "image",
          version: 1,
          props: {
            asset: {
              url: "https://cdn.example.com/hero.jpg",
              filename: "hero.jpg",
              mimeType: "image/jpeg",
            },
            altText: "Volunteers at an event",
            displayWidth: { unit: "percent", value: 100 },
            align: "center",
            link: null,
            spacing: SPACING,
          },
        },
        "cta-external": {
          id: "cta-external",
          type: "cta",
          version: 1,
          props: {
            label: richText("Fill out the external form"),
            destination: {
              segments: [
                {
                  kind: "literal",
                  value: "https://forms.example.com/register",
                },
              ],
            },
            typography: { ...TYPOGRAPHY, fontWeight: "bold", color: "#ffffff" },
            backgroundColor: "#000000",
            align: "center",
            width: { unit: "auto" },
            borderRadiusPx: 4,
            spacing: SPACING,
            margin: {
              topPx: 6,
              rightPx: 7,
              bottomPx: 8,
              leftPx: 9,
            },
            shadow: {
              offsetXPx: 2,
              offsetYPx: 4,
              blurPx: 10,
              spreadPx: -2,
              color: "#00000033",
            },
          },
        },
        "cta-relative": {
          id: "cta-relative",
          type: "cta",
          version: 1,
          props: {
            label: richText("Learn more"),
            destination: { segments: [{ kind: "literal", value: "/about" }] },
            typography: { ...TYPOGRAPHY, fontWeight: "bold", color: "#ffffff" },
            backgroundColor: "#000000",
            align: "center",
            width: { unit: "auto" },
            borderRadiusPx: 4,
            spacing: SPACING,
            shadow: null,
          },
        },
        "divider-1": {
          id: "divider-1",
          type: "divider",
          version: 1,
          props: {
            color: "#cccccc",
            thicknessPx: 1,
            width: { unit: "percent", value: 100 },
            style: "solid",
            spacing: SPACING,
          },
        },
        "spacer-1": {
          id: "spacer-1",
          type: "spacer",
          version: 1,
          props: { heightPx: 40 },
        },
      },
      settings: {
        language: "en",
        title: "Join the campaign",
        metaDescription: null,
        pageBackgroundColor: "#ffffff",
        contentWidth: { unit: "px", value: 960 },
        spacing: { topPx: 2, rightPx: 3, bottomPx: 4, leftPx: 5 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
        faviconUrl: null,
      },
    };
  }

  const html = expectRender(fullDocument());

  test("renders every built-in block", () => {
    assert.match(html, /<h1/);
    assert.match(html, /<p style=/);
    assert.match(html, /<img src="https:\/\/cdn\.example\.com\/hero\.jpg"/);
    assert.match(html, /Fill out the external form/);
    assert.match(html, /border-top:1px solid #cccccc/);
    assert.match(html, /height:40px/);
  });

  test("an image's rounded corners survive to the rendered <img>", () => {
    const input = fullDocument() as { nodes: Record<string, any> };
    input.nodes["image-1"].props.borderRadiusByCorner = true;
    input.nodes["image-1"].props.borderTopLeftRadiusPx = 4;
    input.nodes["image-1"].props.borderTopRightRadiusPx = 8;
    input.nodes["image-1"].props.borderBottomRightRadiusPx = 12;
    input.nodes["image-1"].props.borderBottomLeftRadiusPx = 16;
    const rendered = expectRender(input);
    assert.match(
      rendered,
      /<img[^>]*style="[^"]*border-radius:4px 8px 12px 16px;/,
    );
  });

  test("renders document spacing plus section and button shadows inline", () => {
    assert.match(
      html,
      /padding-top:2px;padding-right:3px;padding-bottom:4px;padding-left:5px/,
    );
    assert.match(html, /box-shadow:0px 7px 21px 0px #00000033/);
    assert.match(html, /box-shadow:2px 4px 10px -2px #00000033/);
    assert.match(
      html,
      /margin-top:2px;margin-right:3px;margin-bottom:4px;margin-left:5px/,
    );
    assert.match(
      html,
      /padding-top:8px;padding-right:0px;padding-bottom:8px;padding-left:0px[^>]*margin-top:6px;margin-right:7px;margin-bottom:8px;margin-left:9px/,
    );
  });

  test("an external hosted-form CTA/link opens a new browsing context with rel=noopener noreferrer", () => {
    assert.match(
      html,
      /<a href="https:\/\/forms\.example\.com\/register"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    );
    assert.match(
      html,
      /<a href="https:\/\/forms\.example\.com\/sign"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    );
  });

  test("a relative CTA and an anchor link stay same-page — no target/rel", () => {
    assert.match(html, /<a href="\/about" style="[^"]*"\s*>Learn more<\/a>/);
    assert.match(html, /<a href="#faq" style="[^"]*"\s*>FAQ<\/a>/);
  });

  test("parses as a well-formed standalone browser document with no forbidden content (tasks 10.5-10.6)", () => {
    const dom = new JSDOM(html, { url: "http://localhost/" });
    const { document } = dom.window;
    assert.equal(document.documentElement.lang, "en");
    assert.equal(document.querySelectorAll("script").length, 0);
    assert.equal(document.querySelectorAll("iframe").length, 0);
    assert.equal(document.querySelectorAll("form").length, 0);
    assert.ok(document.querySelector("main"));
    assert.ok(document.querySelector("section"));
    dom.window.close();
  });
});

test.describe("landing renderer — safety and safe relative/anchor links", () => {
  function documentWithCtaDestination(destination: string) {
    return {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "landing-page",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "document-root",
          version: 1,
          children: ["section-1"],
          props: {},
        },
        "section-1": {
          id: "section-1",
          type: "section",
          version: 1,
          children: ["cta-1"],
          props: {
            background: { color: null },
            contentWidth: { unit: "px", value: 960 },
            spacing: SPACING,
            align: "left",
            shadow: null,
          },
        },
        "cta-1": {
          id: "cta-1",
          type: "cta",
          version: 1,
          props: {
            label: richText("Go"),
            destination: {
              segments: [{ kind: "literal", value: destination }],
            },
            typography: TYPOGRAPHY,
            backgroundColor: "#000000",
            align: "left",
            width: { unit: "auto" },
            borderRadiusPx: 0,
            spacing: SPACING,
            shadow: null,
          },
        },
      },
      settings: {
        language: "en",
        title: "Test",
        metaDescription: null,
        pageBackgroundColor: "#ffffff",
        contentWidth: { unit: "px", value: 960 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
        faviconUrl: null,
      },
    };
  }

  for (const scheme of [
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "vbscript:msgbox(1)",
    "ftp://example.com/file",
  ]) {
    test(`rejects the "${scheme}" destination as a blocking error`, () => {
      const result = exportVisualDocument(documentWithCtaDestination(scheme));
      assert.equal(result.html, null);
      assert.ok(result.errors.length > 0);
    });
  }

  test("accepts safe relative and anchor destinations", () => {
    expectRender(documentWithCtaDestination("/donate"));
    expectRender(documentWithCtaDestination("#section-2"));
    expectRender(documentWithCtaDestination("?utm_source=email"));
  });
});

test.describe("landing renderer — social block", () => {
  function documentWithSocial(props: Record<string, unknown>) {
    const document = createStarterDocument("landing-page");
    document.nodes["section-1"] = {
      ...document.nodes["section-1"],
      children: ["social-1"],
    } as (typeof document.nodes)["section-1"];
    document.nodes["social-1"] = {
      id: "social-1",
      type: "social",
      version: 1,
      props,
    } as unknown as (typeof document.nodes)["section-1"];
    return document as unknown as Record<string, unknown>;
  }

  test("lays icons out in a wrapping flex row, never inline svg", () => {
    const html = expectRender(
      documentWithSocial({
        items: [
          { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
          { id: "b", platform: "instagram", url: "https://instagram.com/acme" },
        ],
        iconStyle: "filled",
        shape: "square",
        color: "#000000",
        glyphTone: "light",
        iconSizePx: 32,
        gapPx: 8,
        align: "center",
        spacing: SPACING,
        margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }),
    );
    assert.doesNotMatch(html, /<svg/);
    assert.match(html, /flex-wrap:wrap/);
    assert.match(html, /<img src="data:image\/png;base64,/);
  });
});

test("landing export renders a run in its own color and font", () => {
  const html = renderRichTextInlineHtml(
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
              text: "Valentina",
              marks: [],
              color: "#e75480",
              fontFamily: '"Snell Roundhand", "Segoe Script", cursive',
            },
            { type: "text", text: " a trecut", marks: [] },
          ],
        },
      ],
    },
    { color: "#0000ee", underline: true },
  );
  assert.equal(
    html,
    '<span style="color:#e75480;font-family:Snell Roundhand, Segoe Script, cursive;">Valentina</span> a trecut',
  );
});
