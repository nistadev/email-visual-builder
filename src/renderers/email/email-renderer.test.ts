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

const RECIPIENT_FIRST_NAME: VariableDefinition = {
  key: "recipient.firstName",
  token: "%recipient.firstName%",
  label: "Recipient first name",
  sampleValue: "Alex",
  allowedContexts: ["text"],
};

const DONATE_URL: VariableDefinition = {
  key: "donate.url",
  token: "%donate.url%",
  label: "Donate link",
  allowedContexts: ["url"],
};

function registriesWithVariables(): BuilderRegistries {
  const variables = createVariableRegistry([RECIPIENT_FIRST_NAME, DONATE_URL]);
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

test.describe("email renderer — default/empty document", () => {
  test("a fresh starter document (one empty section) renders a valid standalone document", () => {
    const html = expectRender(
      JSON.parse(JSON.stringify(createStarterDocument("email"))),
    );
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<\/html>$/);
    // An empty section still produces a valid, non-crashing nested table shell.
    assert.match(html, /<table role="presentation"/);
  });

  test("document content width and alignment reach the email table shell", () => {
    const document = createStarterDocument("email");
    document.settings.contentWidth = { unit: "percent", value: 72 };
    document.settings.contentAlign = "right";
    const html = expectRender(JSON.parse(JSON.stringify(document)));

    assert.match(html, /<td align="right">/);
    assert.match(
      html,
      /<table role="presentation" width="72%"[^>]*align="right">/,
    );
  });

  test("a pixel document width stays capped on desktop and shrinks on mobile", () => {
    const document = createStarterDocument("email");
    document.settings.contentWidth = { unit: "px", value: 600 };
    const html = expectRender(JSON.parse(JSON.stringify(document)));

    assert.equal(
      (
        html.match(
          /<table role="presentation" width="600"[^>]*style="width:100%;max-width:600px;[^"]*">/g,
        ) ?? []
      ).length,
      2,
      "both the document shell and default section are fluid up to 600px",
    );
  });
});

test.describe("email renderer — columns", () => {
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
        children: [`heading-${columnId}`],
        props: { background: { color: null }, spacing: SPACING },
      };
      columns[`heading-${columnId}`] = {
        id: `heading-${columnId}`,
        type: "heading",
        version: 1,
        props: {
          level: 3,
          text: richText(`Column ${columnId}`),
          typography: TYPOGRAPHY,
          spacing: SPACING,
          align: "left",
        },
      };
    }
    return {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "email",
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
            contentWidth: { unit: "px", value: 600 },
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
        previewText: "",
        canvasBackgroundColor: "#f4f4f4",
        contentWidth: { unit: "px", value: 600 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
      },
    };
  }

  test("a single-column layout renders one column cell with no stacking media rule", () => {
    const html = expectRender(documentWithColumns(1, "no-stack"));
    assert.equal((html.match(/<td width="100%"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /@media/);
  });

  test("a multi-column layout renders one <td> per column and a deterministic stacking media rule", () => {
    const html = expectRender(documentWithColumns(3, "stack"));
    assert.equal((html.match(/<td width="33%"/g) ?? []).length, 2);
    assert.equal((html.match(/<td width="34%"/g) ?? []).length, 1);
    assert.match(
      html,
      /@media only screen and \(max-width:480px\)\{\.vb-col-stack-0\{display:block !important;width:100% !important;\}\}/,
    );
  });

  test("a no-stack multi-column layout renders no responsive media rule", () => {
    const html = expectRender(documentWithColumns(2, "no-stack"));
    assert.doesNotMatch(html, /@media/);
  });
});

test.describe("email renderer — every built-in block, nested rich text, and variables", () => {
  function fullDocument(): Record<string, unknown> {
    return {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "email",
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
            "image-blank",
            "cta-1",
            "divider-1",
            "spacer-1",
          ],
          props: {
            background: { color: "#ffffff" },
            contentWidth: { unit: "px", value: 600 },
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
              offsetYPx: 6,
              blurPx: 18,
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
            text: {
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
                  ],
                },
              ],
            },
            typography: { ...TYPOGRAPHY, fontSizePx: 28, fontWeight: "bold" },
            spacing: SPACING,
            align: "left",
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
                  align: "left",
                  children: [
                    { type: "text", text: "Bold", marks: ["bold"] },
                    { type: "text", text: " and ", marks: [] },
                    {
                      type: "text",
                      text: "italic-underline",
                      marks: ["italic", "underline"],
                      color: "#ff0000",
                    },
                    { type: "break" },
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
                      children: [
                        { type: "text", text: "Donate now", marks: [] },
                      ],
                    },
                  ],
                },
                {
                  type: "bulleted-list",
                  children: [
                    {
                      type: "list-item",
                      children: [
                        { type: "text", text: "First item", marks: [] },
                      ],
                    },
                    {
                      type: "list-item",
                      children: [
                        {
                          type: "text",
                          text: "Second item",
                          marks: ["strikethrough"],
                        },
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
              url: "https://cdn.example.com/photo.jpg",
              filename: "photo.jpg",
              mimeType: "image/jpeg",
              widthPx: 600,
              heightPx: 400,
            },
            altText: "A smiling volunteer",
            displayWidth: { unit: "percent", value: 100 },
            align: "center",
            link: null,
            spacing: SPACING,
          },
        },
        "image-blank": {
          id: "image-blank",
          type: "image",
          version: 1,
          props: {
            asset: null,
            altText: "",
            displayWidth: { unit: "percent", value: 100 },
            align: "center",
            link: null,
            spacing: SPACING,
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
              offsetXPx: 1,
              offsetYPx: 3,
              blurPx: 8,
              spreadPx: -1,
              color: "#00000033",
            },
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
          props: { heightPx: 32 },
        },
      },
      settings: {
        language: "en",
        previewText: "Thanks for your support.",
        canvasBackgroundColor: "#f4f4f4",
        contentWidth: { unit: "px", value: 600 },
        spacing: { topPx: 3, rightPx: 4, bottomPx: 5, leftPx: 6 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
      },
    };
  }

  const html = expectRender(fullDocument(), registriesWithVariables());

  test("renders the preview-text preheader", () => {
    assert.match(html, /Thanks for your support\./);
  });

  test("preserves the exact configured variable token for later recipient substitution", () => {
    assert.match(html, /Hi %recipient\.firstName%/);
    assert.match(html, /href="%donate\.url%"/);
  });

  test("renders every built-in block", () => {
    assert.match(html, /<h1/);
    assert.match(html, /<p style=/);
    assert.match(html, /<img src="https:\/\/cdn\.example\.com\/photo\.jpg"/);
    assert.match(html, /Donate now/);
    assert.match(html, /border-top:1px solid #cccccc/);
    assert.match(html, /line-height:32px/);
  });

  test("renders document spacing plus section and button shadows inline", () => {
    assert.match(
      html,
      /padding-top:3px;padding-right:4px;padding-bottom:5px;padding-left:6px/,
    );
    assert.match(html, /box-shadow:0px 6px 18px 0px #00000033/);
    assert.match(html, /box-shadow:1px 3px 8px -1px #00000033/);
    assert.match(
      html,
      /padding-top:2px;padding-right:3px;padding-bottom:4px;padding-left:5px;text-align:center/,
    );
    assert.match(
      html,
      /padding-top:6px;padding-right:7px;padding-bottom:8px;padding-left:9px;text-align:center/,
    );
    assert.match(
      html,
      /padding-top:8px;padding-right:0px;padding-bottom:8px;padding-left:0px;background-color:#000000/,
    );
  });

  test("renders nested rich-text formatting and lists", () => {
    assert.match(html, /<strong>Bold<\/strong>/);
    assert.match(html, /<em>.*italic-underline.*<\/em>/);
    assert.match(html, /text-decoration:underline/);
    assert.match(html, /<ul style=/);
    assert.match(html, /<ol style=/);
    assert.match(html, /First item/);
    assert.match(html, /text-decoration:line-through/);
  });

  test("rich-text borders enclose the block padding", () => {
    const input = fullDocument();
    const nodes = input.nodes as Record<string, any>;
    nodes["rich-text-1"].props.border = true;
    nodes["rich-text-1"].props.borderWidth = 2;
    nodes["rich-text-1"].props.borderColor = "#123456";
    nodes["rich-text-1"].props.spacing = {
      topPx: 10,
      rightPx: 11,
      bottomPx: 12,
      leftPx: 13,
    };
    const rendered = expectRender(input, registriesWithVariables());
    assert.match(
      rendered,
      /border:2px solid #123456;[^>]*><tr><td style="padding-top:10px;padding-right:11px;padding-bottom:12px;padding-left:13px;">/,
    );
  });

  test("a blank image block renders nothing rather than a broken <img>", () => {
    assert.doesNotMatch(html, /alt=""/);
  });

  test("an image's rounded corners survive to the rendered <img>", () => {
    const input = fullDocument();
    const nodes = input.nodes as Record<string, any>;
    nodes["image-1"].props.borderRadiusByCorner = true;
    nodes["image-1"].props.borderTopLeftRadiusPx = 4;
    nodes["image-1"].props.borderTopRightRadiusPx = 8;
    nodes["image-1"].props.borderBottomRightRadiusPx = 12;
    nodes["image-1"].props.borderBottomLeftRadiusPx = 16;
    const rendered = expectRender(input, registriesWithVariables());
    assert.match(
      rendered,
      /<img[^>]*style="[^"]*border-radius:4px 8px 12px 16px;/,
    );
  });

  test("escapes HTML metacharacters in authored text", () => {
    const input = fullDocument();
    const nodes = input.nodes as Record<string, any>;
    nodes["heading-1"].props.text = richText('<script>alert("x")</script>');
    const unsafeHtml = expectRender(input, registriesWithVariables());
    assert.doesNotMatch(unsafeHtml, /<script>alert/);
    assert.match(unsafeHtml, /&lt;script&gt;/);
  });

  test("parses as a well-formed standalone browser document (task 9.7)", () => {
    const dom = new JSDOM(html, { url: "http://localhost/" });
    const { document } = dom.window;
    assert.equal(document.documentElement.lang, "en");
    assert.equal(document.querySelectorAll("script").length, 0);
    assert.equal(document.querySelectorAll("iframe").length, 0);
    assert.equal(document.querySelectorAll("form").length, 0);
    assert.ok(document.querySelector("h1"));
    assert.ok(document.querySelector("img[src]"));
    assert.ok(document.querySelector('a[href="%donate.url%"]'));
    dom.window.close();
  });
});

test.describe("email renderer — long content", () => {
  test("a very long rich-text paragraph renders in full without truncation", () => {
    const longText = "Every gift matters. ".repeat(500);
    const input = {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "email",
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
          children: ["rich-text-1"],
          props: {
            background: { color: null },
            contentWidth: { unit: "px", value: 600 },
            spacing: SPACING,
            align: "left",
            shadow: null,
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
                  align: "left",
                  children: [{ type: "text", text: longText, marks: [] }],
                },
              ],
            },
            typography: TYPOGRAPHY,
            spacing: SPACING,
          },
        },
      },
      settings: {
        language: "en",
        previewText: "",
        canvasBackgroundColor: "#f4f4f4",
        contentWidth: { unit: "px", value: 600 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
      },
    };
    const html = expectRender(input);
    assert.ok(html.includes(longText.trim()));
  });
});

test.describe("email renderer — maximum output size", () => {
  test("rendered HTML over the configured ceiling blocks export with no HTML returned", () => {
    const richTextIds = Array.from(
      { length: 190 },
      (_, index) => `rich-text-${index}`,
    );
    const richTextNodes: Record<string, unknown> = {};
    const longText = "x".repeat(9000);
    for (const id of richTextIds) {
      richTextNodes[id] = {
        id,
        type: "rich-text",
        version: 1,
        props: {
          value: {
            kind: "donativus.rich-text",
            version: 1,
            children: [
              {
                type: "paragraph",
                align: "left",
                children: [{ type: "text", text: longText, marks: [] }],
              },
            ],
          },
          typography: TYPOGRAPHY,
          spacing: SPACING,
        },
      };
    }
    const input = {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "email",
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
          children: richTextIds,
          props: {
            background: { color: null },
            contentWidth: { unit: "px", value: 600 },
            spacing: SPACING,
            align: "left",
            shadow: null,
          },
        },
        ...richTextNodes,
      },
      settings: {
        language: "en",
        previewText: "",
        canvasBackgroundColor: "#f4f4f4",
        contentWidth: { unit: "px", value: 600 },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        defaultTypography: TYPOGRAPHY,
        textColor: "#333333",
        linkStyle: { color: "#1a73e8", underline: true },
      },
    };

    const result = exportVisualDocument(input);
    assert.equal(result.html, null);
    assert.ok(
      result.errors.some((issue) => issue.code === "document/html-too-large"),
    );
  });
});

test.describe("email renderer — social block", () => {
  function documentWithSocial(props: Record<string, unknown>) {
    const document = createStarterDocument("email");
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

  test("renders raster img sources, never inline svg", () => {
    const html = expectRender(
      documentWithSocial({
        items: [
          { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
          { id: "b", platform: "instagram", url: "" },
        ],
        iconStyle: "logo",
        shape: "circle",
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
    assert.match(html, /<img src="data:image\/png;base64,/);
  });

  test("uses public icon URLs when rendering for delivery", () => {
    const html = exportVisualDocument(
      documentWithSocial({
        items: [{ id: "a", platform: "facebook", url: "" }],
        iconStyle: "logo",
        shape: "circle",
        color: "#000000",
        glyphTone: "light",
        iconSizePx: 32,
        gapPx: 8,
        align: "center",
        spacing: SPACING,
        margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }),
      undefined,
      { emailAssetBaseUrl: "https://api.example.test" },
    ).html;

    assert.match(
      html ?? "",
      /<img src="https:\/\/api\.example\.test\/public\/email-assets\/social\/facebook\/brand\.png"/,
    );
    assert.doesNotMatch(html ?? "", /data:image\/png;base64,/);
  });

  test("wraps an item with a URL in a link, and skips the wrapper when the URL is empty", () => {
    const html = expectRender(
      documentWithSocial({
        items: [
          { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
          { id: "b", platform: "instagram", url: "" },
        ],
        iconStyle: "logo",
        shape: "circle",
        color: "#000000",
        glyphTone: "light",
        iconSizePx: 32,
        gapPx: 8,
        align: "center",
        spacing: SPACING,
        margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }),
    );
    assert.match(
      html,
      /<a href="https:\/\/facebook\.com\/acme" target="_blank" rel="noopener noreferrer"[^>]*><img/,
    );
    // Only the Facebook item has a URL — the Instagram item (empty url) must not be link-wrapped.
    assert.equal((html.match(/<a href="/g) ?? []).length, 1);
  });

  test("filled-color uses the shared custom color, not the platform's brand color", () => {
    const html = expectRender(
      documentWithSocial({
        items: [
          { id: "a", platform: "facebook", url: "" },
          { id: "b", platform: "instagram", url: "" },
        ],
        iconStyle: "filled-color",
        shape: "circle",
        color: "#123456",
        glyphTone: "dark",
        iconSizePx: 32,
        gapPx: 8,
        align: "center",
        spacing: SPACING,
        margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }),
    );
    // Both items share one background color (not Facebook's #1877F2 / Instagram's #E4405F).
    assert.equal((html.match(/background-color:#123456/g) ?? []).length, 2);
    assert.doesNotMatch(html, /background-color:#1877f2/i);
    assert.doesNotMatch(html, /background-color:#e4405f/i);
  });

  test("no-color has no background shape at all", () => {
    const html = expectRender(
      documentWithSocial({
        items: [{ id: "a", platform: "facebook", url: "" }],
        iconStyle: "no-color",
        shape: "circle",
        color: "#123456",
        glyphTone: "dark",
        iconSizePx: 32,
        gapPx: 8,
        align: "center",
        spacing: SPACING,
        margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }),
    );
    // The icon-wrapper cell carries no background-color (unlike the surrounding document chrome, which legitimately does).
    assert.match(html, /<td style="width:32px;height:32px;border-radius:0;/);
    assert.doesNotMatch(
      html,
      /<td style="width:32px;height:32px;[^"]*background-color/,
    );
  });
});

test("email export renders a run in its own color and font", () => {
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
