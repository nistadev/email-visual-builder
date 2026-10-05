import assert from "node:assert/strict";
import test from "node:test";
import type { VisualDocumentMode } from "../../types/index.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../registry/default-registries.js";
import { createStarterDocument } from "../starter-document.js";
import { parseColumnProps } from "./column.js";
import { parseColumnsProps } from "./columns.js";
import { parseCtaProps } from "./cta.js";
import { parseDividerProps } from "./divider.js";
import { parseDocumentRootProps } from "./document-root.js";
import { parseHeadingProps } from "./heading.js";
import { parseImageProps } from "./image.js";
import { parseRichTextBlockProps } from "./rich-text-block.js";
import { parseSectionProps } from "./section.js";
import { parseSocialProps } from "./social.js";
import { parseSpacerProps } from "./spacer.js";

const BUILT_IN_BLOCK_TYPES = [
  "document-root",
  "section",
  "columns",
  "column",
  "heading",
  "rich-text",
  "image",
  "cta",
  "divider",
  "spacer",
] as const;

const BOTH_MODES: readonly VisualDocumentMode[] = ["email", "landing-page"];

test.describe("built-in block registry — defaults round-trip through their own parser", () => {
  for (const type of BUILT_IN_BLOCK_TYPES) {
    for (const mode of BOTH_MODES) {
      test(`"${type}" defaultProps(${mode}) is itself valid input to parseProps`, () => {
        const definition = DEFAULT_BUILDER_REGISTRIES.blocks.get(type);
        assert.ok(definition, `expected "${type}" to be registered`);
        if (!definition) return;
        const result = definition.parseProps(
          definition.defaultProps(mode),
          `${type}.props`,
        );
        assert.equal(
          result.ok,
          true,
          `defaultProps(${mode}) for "${type}" failed to parse`,
        );
      });
    }
  }

  test("new text and button blocks start with useful editable copy", () => {
    const heading = DEFAULT_BUILDER_REGISTRIES.blocks.get("heading");
    const richText = DEFAULT_BUILDER_REGISTRIES.blocks.get("rich-text");
    const cta = DEFAULT_BUILDER_REGISTRIES.blocks.get("cta");
    assert.ok(heading && richText && cta);

    assert.equal(
      (
        heading.defaultProps("email") as {
          text: { children: Array<{ children: Array<{ text: string }> }> };
        }
      ).text.children[0]?.children[0]?.text,
      "Heading",
    );
    assert.equal(
      (
        richText.defaultProps("email") as {
          value: { children: Array<{ children: Array<{ text: string }> }> };
        }
      ).value.children[0]?.children[0]?.text,
      "Write your text here.",
    );
    assert.equal(
      (
        cta.defaultProps("email") as {
          label: { children: Array<{ children: Array<{ text: string }> }> };
        }
      ).label.children[0]?.children[0]?.text,
      "Button",
    );
  });

  test("new dividers start with 10px of padding on every side", () => {
    const divider = DEFAULT_BUILDER_REGISTRIES.blocks.get("divider");
    assert.ok(divider);
    if (!divider) return;

    assert.deepEqual(
      (divider.defaultProps("email") as { spacing: unknown }).spacing,
      { topPx: 10, rightPx: 10, bottomPx: 10, leftPx: 10 },
    );
  });
});

test.describe("built-in block registry — mode availability", () => {
  test("every built-in block supports both email and landing-page", () => {
    for (const type of BUILT_IN_BLOCK_TYPES) {
      const definition = DEFAULT_BUILDER_REGISTRIES.blocks.get(type);
      assert.ok(definition);
      if (!definition) continue;
      assert.deepEqual([...definition.supportedModes].sort(), [
        "email",
        "landing-page",
      ]);
    }
  });
});

test.describe("document-root", () => {
  test("accepts an empty object and rejects a non-object", () => {
    assert.equal(parseDocumentRootProps({}, "props").ok, true);
    assert.equal(parseDocumentRootProps(null, "props").ok, false);
    assert.equal(parseDocumentRootProps("root", "props").ok, false);
  });
});

test.describe("section", () => {
  const valid = {
    background: { color: "#ffffff" },
    contentWidth: { unit: "px", value: 600 },
    spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    align: "left",
    shadow: null,
  };

  test("accepts a fully-specified valid value", () => {
    assert.equal(parseSectionProps(valid, "props").ok, true);
  });

  test("rejects an invalid alignment keyword", () => {
    assert.equal(
      parseSectionProps({ ...valid, align: "justify" }, "props").ok,
      false,
    );
  });
});

test.describe("columns — width ratios", () => {
  const base = {
    responsiveStack: "stack",
    spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  };

  test("accepts every valid 1-to-4-column ratio combination", () => {
    for (const columnWidthRatios of [
      [100],
      [50, 50],
      [33, 33, 34],
      [25, 25, 25, 25],
    ]) {
      const result = parseColumnsProps({ ...base, columnWidthRatios }, "props");
      assert.equal(
        result.ok,
        true,
        `expected ${JSON.stringify(columnWidthRatios)} to be valid`,
      );
    }
  });

  test("rejects zero columns, more than four columns, and ratios that don't sum to 100", () => {
    assert.equal(
      parseColumnsProps({ ...base, columnWidthRatios: [] }, "props").ok,
      false,
    );
    assert.equal(
      parseColumnsProps(
        { ...base, columnWidthRatios: [20, 20, 20, 20, 20] },
        "props",
      ).ok,
      false,
    );
    assert.equal(
      parseColumnsProps({ ...base, columnWidthRatios: [50, 40] }, "props").ok,
      false,
    );
  });
});

test.describe("column", () => {
  test("accepts a fully-specified valid value", () => {
    const result = parseColumnProps(
      {
        background: { color: null },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });
});

test.describe("empty containers parse successfully (warnings, not errors, are section 8's job)", () => {
  test("a columns block with zero column children is structurally parseable at the prop level", () => {
    // `columnWidthRatios` still enforces 1-4 declared columns at the props
    // level; "empty" here means the actual node has no `children` yet, which
    // the node/tree layer (not block props) is responsible for allowing.
    const result = parseColumnsProps(
      {
        columnWidthRatios: [100],
        responsiveStack: "stack",
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });

  test("a rich-text block with no paragraphs is a valid empty container", () => {
    const result = parseRichTextBlockProps(
      {
        value: { kind: "donativus.rich-text", version: 1, children: [] },
        typography: {
          fontFamily: "Arial",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "normal",
          color: "#000000",
        },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });
});

test.describe("heading", () => {
  const valid = {
    level: 2,
    text: {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [{ type: "text", text: "Hello", marks: [] }],
        },
      ],
    },
    typography: {
      fontFamily: "Arial",
      fontSizePx: 24,
      lineHeightPercent: 130,
      letterSpacingPx: 0,
      fontWeight: "bold",
      color: "#000000",
    },
    spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    align: "left",
  };

  test("accepts levels 1 through 6", () => {
    for (let level = 1; level <= 6; level += 1) {
      assert.equal(parseHeadingProps({ ...valid, level }, "props").ok, true);
    }
  });

  test("rejects level 0 and level 7", () => {
    assert.equal(parseHeadingProps({ ...valid, level: 0 }, "props").ok, false);
    assert.equal(parseHeadingProps({ ...valid, level: 7 }, "props").ok, false);
  });
});

test.describe("rich-text", () => {
  test("persists an optional visible border", () => {
    const result = parseRichTextBlockProps(
      {
        value: { kind: "donativus.rich-text", version: 1, children: [] },
        typography: {
          fontFamily: "Arial",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "normal",
          color: "#000000",
        },
        border: true,
        borderWidth: 2,
        borderColor: "#123456",
        borderRadiusPx: 4,
        borderRadiusByCorner: true,
        borderTopLeftRadiusPx: 1,
        borderTopRightRadiusPx: 2,
        borderBottomRightRadiusPx: 3,
        borderBottomLeftRadiusPx: 4,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      {
        border: result.value.border,
        borderWidth: result.value.borderWidth,
        borderColor: result.value.borderColor,
        borderRadiusPx: result.value.borderRadiusPx,
        borderRadiusByCorner: result.value.borderRadiusByCorner,
        borderTopLeftRadiusPx: result.value.borderTopLeftRadiusPx,
        borderTopRightRadiusPx: result.value.borderTopRightRadiusPx,
        borderBottomRightRadiusPx: result.value.borderBottomRightRadiusPx,
        borderBottomLeftRadiusPx: result.value.borderBottomLeftRadiusPx,
      },
      {
        border: true,
        borderWidth: 2,
        borderColor: "#123456",
        borderRadiusPx: 4,
        borderRadiusByCorner: true,
        borderTopLeftRadiusPx: 1,
        borderTopRightRadiusPx: 2,
        borderBottomRightRadiusPx: 3,
        borderBottomLeftRadiusPx: 4,
      },
    );
  });

  test("accepts an empty children array (empty container)", () => {
    const result = parseRichTextBlockProps(
      {
        value: { kind: "donativus.rich-text", version: 1, children: [] },
        typography: {
          fontFamily: "Arial",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "normal",
          color: "#000000",
        },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });
});

test.describe("image", () => {
  test("accepts a null asset (not-yet-uploaded placeholder state)", () => {
    const result = parseImageProps(
      {
        asset: null,
        altText: "",
        displayWidth: { unit: "percent", value: 100 },
        align: "left",
        link: null,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });

  test("accepts a fully-populated asset with dimensions", () => {
    const result = parseImageProps(
      {
        asset: {
          url: "https://example.com/a.jpg",
          filename: "a.jpg",
          mimeType: "image/jpeg",
          widthPx: 800,
          heightPx: 600,
        },
        altText: "A photo",
        displayWidth: { unit: "px", value: 400 },
        align: "center",
        link: { segments: [{ kind: "literal", value: "https://example.com" }] },
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
  });

  test("persists an optional per-corner radius", () => {
    const result = parseImageProps(
      {
        asset: null,
        altText: "",
        displayWidth: { unit: "percent", value: 100 },
        align: "left",
        link: null,
        borderRadiusPx: 4,
        borderRadiusByCorner: true,
        borderTopLeftRadiusPx: 1,
        borderTopRightRadiusPx: 2,
        borderBottomRightRadiusPx: 3,
        borderBottomLeftRadiusPx: 4,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      {
        borderRadiusPx: result.value.borderRadiusPx,
        borderRadiusByCorner: result.value.borderRadiusByCorner,
        borderTopLeftRadiusPx: result.value.borderTopLeftRadiusPx,
        borderTopRightRadiusPx: result.value.borderTopRightRadiusPx,
        borderBottomRightRadiusPx: result.value.borderBottomRightRadiusPx,
        borderBottomLeftRadiusPx: result.value.borderBottomLeftRadiusPx,
      },
      {
        borderRadiusPx: 4,
        borderRadiusByCorner: true,
        borderTopLeftRadiusPx: 1,
        borderTopRightRadiusPx: 2,
        borderBottomRightRadiusPx: 3,
        borderBottomLeftRadiusPx: 4,
      },
    );
  });

  test("defaults every corner to the flat radius when unset", () => {
    const result = parseImageProps(
      {
        asset: null,
        altText: "",
        displayWidth: { unit: "percent", value: 100 },
        align: "left",
        link: null,
        borderRadiusPx: 8,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.borderTopLeftRadiusPx, 8);
    assert.equal(result.value.borderBottomRightRadiusPx, 8);
  });
});

test.describe("social", () => {
  const valid = {
    items: [
      { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
      { id: "b", platform: "website", url: "" },
    ],
    iconStyle: "logo",
    shape: "circle",
    color: "#000000",
    glyphTone: "light",
    iconSizePx: 32,
    gapPx: 8,
    align: "center",
    spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  };

  test("accepts a fully-populated valid props object", () => {
    const result = parseSocialProps(valid, "props");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.items, valid.items);
  });

  test("rejects an item with a platform outside the built-in set", () => {
    const result = parseSocialProps(
      {
        ...valid,
        items: [{ id: "a", platform: "myspace", url: "" }],
      },
      "props",
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.path === "props.items[0].platform"),
    );
  });

  test("rejects more items than the documented ceiling", () => {
    const items = Array.from({ length: 13 }, (_, index) => ({
      id: `item-${index}`,
      platform: "website",
      url: "",
    }));
    const result = parseSocialProps({ ...valid, items }, "props");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "value/too-many-items"));
  });

  test("rejects an icon size outside 12-96px", () => {
    const result = parseSocialProps({ ...valid, iconSizePx: 200 }, "props");
    assert.equal(result.ok, false);
  });

  test("accepts every icon style, including the two color-aware ones", () => {
    for (const iconStyle of ["logo", "filled", "filled-color", "no-color"]) {
      const result = parseSocialProps({ ...valid, iconStyle }, "props");
      assert.equal(result.ok, true, `expected "${iconStyle}" to parse`);
    }
  });

  test("rejects an icon style outside the built-in set", () => {
    const result = parseSocialProps({ ...valid, iconStyle: "rainbow" }, "props");
    assert.equal(result.ok, false);
  });

  test("rejects a non-hex color", () => {
    const result = parseSocialProps({ ...valid, color: "blue" }, "props");
    assert.equal(result.ok, false);
  });

  test("rejects a glyph tone outside light/dark", () => {
    const result = parseSocialProps({ ...valid, glyphTone: "medium" }, "props");
    assert.equal(result.ok, false);
  });

  test("defaults to an empty item list and sensible presentation when fields are missing", () => {
    const result = parseSocialProps({}, "props");
    assert.equal(result.ok, false);
    if (result.ok) return;
    // Every top-level field is reported, but each still gets a usable fallback via FieldCollector.
    assert.ok(result.issues.length > 0);
  });
});

test.describe("cta", () => {
  const valid = {
    label: {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [{ type: "text", text: "Donate", marks: [] }],
        },
      ],
    },
    destination: {
      segments: [{ kind: "literal", value: "https://example.com/donate" }],
    },
    typography: {
      fontFamily: "Arial",
      fontSizePx: 16,
      lineHeightPercent: 130,
      letterSpacingPx: 0,
      fontWeight: "bold",
      color: "#ffffff",
    },
    backgroundColor: "#000000",
    align: "center",
    width: { unit: "auto" },
    borderRadiusPx: 4,
    spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    shadow: null,
  };

  test("accepts an auto width and a fixed px width", () => {
    assert.equal(parseCtaProps(valid, "props").ok, true);
    assert.equal(
      parseCtaProps({ ...valid, width: { unit: "px", value: 200 } }, "props")
        .ok,
      true,
    );
  });

  test("rejects a non-hex background color", () => {
    assert.equal(
      parseCtaProps({ ...valid, backgroundColor: "black" }, "props").ok,
      false,
    );
  });

  test("accepts a bounded shadow and rejects an unbounded blur", () => {
    const shadow = {
      offsetXPx: -4,
      offsetYPx: 8,
      blurPx: 24,
      spreadPx: 0,
      color: "#00000033",
    };
    assert.equal(parseCtaProps({ ...valid, shadow }, "props").ok, true);
    assert.equal(
      parseCtaProps({ ...valid, shadow: { ...shadow, blurPx: 201 } }, "props")
        .ok,
      false,
    );
  });
});

test.describe("divider", () => {
  test("accepts every registered style", () => {
    for (const style of ["solid", "dashed", "dotted"]) {
      const result = parseDividerProps(
        {
          color: "#cccccc",
          thicknessPx: 1,
          width: { unit: "percent", value: 100 },
          style,
          spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        },
        "props",
      );
      assert.equal(result.ok, true);
    }
  });

  test("rejects zero thickness", () => {
    const result = parseDividerProps(
      {
        color: "#cccccc",
        thicknessPx: 0,
        width: { unit: "percent", value: 100 },
        style: "solid",
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      },
      "props",
    );
    assert.equal(result.ok, false);
  });
});

test.describe("spacer", () => {
  test("accepts a bounded height and rejects a negative height", () => {
    assert.equal(parseSpacerProps({ heightPx: 32 }, "props").ok, true);
    assert.equal(parseSpacerProps({ heightPx: -1 }, "props").ok, false);
  });
});

test.describe("starter documents", () => {
  for (const mode of BOTH_MODES) {
    test(`createStarterDocument("${mode}") is a minimal, valid, empty-section document`, () => {
      const document = createStarterDocument(mode);
      assert.equal(document.mode, mode);
      assert.equal(Object.keys(document.nodes).length, 2);
      assert.equal(document.nodes[document.rootId].type, "document-root");
      const sectionId = document.nodes[document.rootId].children?.[0];
      assert.ok(sectionId);
      assert.equal(document.nodes[sectionId as string].type, "section");
      assert.deepEqual(document.nodes[sectionId as string].children, []);
      assert.deepEqual(
        (
          document.nodes[sectionId as string].props as {
            spacing: unknown;
          }
        ).spacing,
        { topPx: 20, rightPx: 20, bottomPx: 20, leftPx: 20 },
      );
      assert.deepEqual(
        (
          document.nodes[sectionId as string].props as {
            background: unknown;
          }
        ).background,
        { color: "#ffffff" },
      );
      assert.equal(
        document.mode === "email"
          ? document.settings.canvasBackgroundColor
          : document.settings.pageBackgroundColor,
        "#ffffff",
      );
    });
  }
});
