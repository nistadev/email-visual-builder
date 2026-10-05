import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BUILDER_REGISTRIES } from "./registry/default-registries.js";
import { importUnlayerEmailDesign } from "./unlayer-import.js";

function importedNodesByType(
  result: Extract<ReturnType<typeof importUnlayerEmailDesign>, { ok: true }>,
  type: string,
) {
  return Object.values(result.value.nodes).filter((node) => node.type === type);
}

test.describe("importUnlayerEmailDesign", () => {
  test("maps body settings, rows, columns, and supported content tools", () => {
    const result = importUnlayerEmailDesign(
      {
        schemaVersion: 17,
        counters: {},
        body: {
          values: {
            backgroundColor: "#f4f4f4",
            contentWidth: "640px",
            contentAlign: "center",
            fontFamily: { value: "Arial, sans-serif" },
            fontWeight: 400,
            textColor: "#333333",
            preheaderText: "A short inbox preview",
            language: "en",
            linkStyle: { linkColor: "#0066cc", linkUnderline: false },
          },
          rows: [
            {
              cells: [1, 1],
              values: {
                backgroundColor: "#ffffff",
                columnsBackgroundColor: "#ffffff",
                padding: "12px 24px",
                noStackMobile: true,
              },
              columns: [
                {
                  values: { backgroundColor: "#ffffff", padding: "8px" },
                  contents: [
                    {
                      type: "heading",
                      values: {
                        headingType: "h2",
                        text: "<strong>Thank you</strong>",
                        fontFamily: { value: "Georgia" },
                        fontWeight: 700,
                        fontSize: "28px",
                        lineHeight: "140%",
                        letterSpacing: "1px",
                        color: "#112233",
                        textAlign: "center",
                        containerPadding: "4px 0",
                      },
                    },
                    {
                      type: "text",
                      values: {
                        text: '<p>Hello <a href="https://example.com">there</a>.</p>',
                        fontFamily: { value: "Arial" },
                        fontWeight: 400,
                        fontSize: 16,
                        lineHeight: "150%",
                        letterSpacing: "0px",
                        color: "#223344",
                        containerPadding: "6px",
                      },
                    },
                    {
                      type: "image",
                      values: {
                        src: {
                          url: "https://cdn.example.com/banner.png",
                          width: 600,
                          height: 200,
                          maxWidth: "100%",
                        },
                        altText: "Campaign banner",
                        textAlign: "center",
                        action: {
                          attrs: { href: "https://example.com/donate" },
                        },
                        containerPadding: "8px",
                      },
                    },
                  ],
                },
                {
                  values: { backgroundColor: "#eeeeee", padding: "10px" },
                  contents: [
                    {
                      type: "button",
                      values: {
                        text: "Donate now",
                        href: { attrs: { href: "https://example.com/donate" } },
                        size: { autoWidth: true },
                        fontFamily: { value: "Arial" },
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: "120%",
                        letterSpacing: "0px",
                        buttonColors: { backgroundColor: "#0066cc" },
                        padding: "12px 24px",
                        borderRadius: "6px",
                        textAlign: "center",
                      },
                    },
                    {
                      type: "divider",
                      values: {
                        width: "75%",
                        border: {
                          borderTopColor: "#445566",
                          borderTopStyle: "dashed",
                          borderTopWidth: "2px",
                        },
                        textAlign: "center",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      DEFAULT_BUILDER_REGISTRIES,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.mode, "email");
    assert.equal(result.value.settings.previewText, "A short inbox preview");
    assert.deepEqual(result.value.settings.contentWidth, {
      unit: "px",
      value: 640,
    });
    assert.deepEqual(result.value.settings.linkStyle, {
      color: "#0066cc",
      underline: false,
    });

    const [columns] = importedNodesByType(result, "columns");
    assert.deepEqual(columns?.props.columnWidthRatios, [50, 50]);
    assert.equal(columns?.props.responsiveStack, "no-stack");

    const [heading] = importedNodesByType(result, "heading");
    assert.equal(heading?.props.level, 2);
    assert.equal(heading?.props.typography.fontFamily, "Georgia");
    assert.equal(heading?.props.typography.fontWeight, "bold");
    assert.equal(heading?.props.align, "center");

    const [text] = importedNodesByType(result, "rich-text");
    assert.equal(text?.props.value.children[0]?.type, "paragraph");
    assert.equal(text?.props.value.children[0]?.children[1]?.type, "link");

    const [image] = importedNodesByType(result, "image");
    assert.equal(image?.props.asset?.url, "https://cdn.example.com/banner.png");
    assert.equal(image?.props.altText, "Campaign banner");
    assert.equal(image?.props.link?.segments[0]?.kind, "literal");

    const [cta] = importedNodesByType(result, "cta");
    assert.deepEqual(cta?.props.width, { unit: "auto" });
    assert.equal(cta?.props.backgroundColor, "#0066cc");

    const [divider] = importedNodesByType(result, "divider");
    assert.equal(divider?.props.style, "dashed");
    assert.equal(divider?.props.thicknessPx, 2);
    assert.deepEqual(divider?.props.width, { unit: "percent", value: 75 });
  });

  test("reports unsupported tools while retaining their textual content", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  { type: "html", values: { html: "<p>Legacy content</p>" } },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.warnings.join(" "), /html/);
    const [text] = importedNodesByType(result, "rich-text");
    assert.equal(
      text?.props.value.children[0]?.children[0]?.type === "text" &&
        text.props.value.children[0].children[0].text,
      "Legacy content",
    );
  });

  test("flattens compatible single-column rows into one editable section", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: { backgroundColor: "#ffffff", padding: "20px" },
            columns: [
              {
                values: {},
                contents: [
                  { type: "heading", values: { text: "First heading" } },
                ],
              },
            ],
          },
          {
            cells: [1],
            values: { backgroundColor: "#ffffff", padding: "20px" },
            columns: [
              {
                values: {},
                contents: [{ type: "text", values: { text: "Second block" } }],
              },
            ],
          },
          {
            cells: [1],
            values: { backgroundColor: "#ffffff", padding: "20px" },
            columns: [
              {
                values: { padding: "12px" },
                contents: [{ type: "text", values: { text: "Styled column" } }],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const root = result.value.nodes[result.value.rootId];
    assert.equal(root?.children?.length, 2);
    const [flatSectionId, styledSectionId] = root?.children ?? [];
    const flatSection = flatSectionId
      ? result.value.nodes[flatSectionId]
      : undefined;
    assert.deepEqual(
      flatSection?.children?.map(
        (childId) => result.value.nodes[childId]?.type,
      ),
      ["heading", "rich-text"],
    );
    assert.equal(
      flatSection?.children?.some(
        (childId) => result.value.nodes[childId]?.type === "columns",
      ),
      false,
    );

    const styledSection = styledSectionId
      ? result.value.nodes[styledSectionId]
      : undefined;
    const columnsId = styledSection?.children?.[0];
    const columns = columnsId ? result.value.nodes[columnsId] : undefined;
    const columnId = columns?.children?.[0];
    const column = columnId ? result.value.nodes[columnId] : undefined;
    assert.equal(columns?.type, "columns");
    assert.equal(column?.type, "column");
    assert.deepEqual(column?.props.spacing, {
      topPx: 12,
      rightPx: 12,
      bottomPx: 12,
      leftPx: 12,
    });
  });

  test("removes unsafe imported URLs before the document reaches the editor", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "text",
                    values: {
                      text: '<p><a href="javascript:alert(1)">Do not run</a></p>',
                    },
                  },
                  {
                    type: "button",
                    values: {
                      text: "Do not run",
                      href: { attrs: { href: "javascript:alert(1)" } },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.warnings.join(" "), /unsafe legacy link/i);
    const [text] = importedNodesByType(result, "rich-text");
    assert.equal(text?.props.value.children[0]?.children[0]?.type, "text");
    const [cta] = importedNodesByType(result, "cta");
    assert.deepEqual(cta?.props.destination, { segments: [] });
  });

  test("drops empty rich-text paragraphs and list items from legacy spacing markup", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "text",
                    values: {
                      text: [
                        "<p>&nbsp;</p>",
                        "<p>   </p>",
                        "<p><br></p>",
                        "<p>Hello<br>there</p>",
                        '<p><a href="https://example.com">&nbsp;</a></p>',
                        "<ul><li>&nbsp;</li><li>Visible item</li></ul>",
                        "<p><br></p>",
                      ].join(""),
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const [text] = importedNodesByType(result, "rich-text");
    const children = text?.props.value.children;
    assert.equal(children?.length, 2);
    const [paragraph, list] = children ?? [];
    assert.deepEqual(paragraph, {
      type: "paragraph",
      align: "left",
      children: [
        { type: "text", text: "Hello", marks: [] },
        { type: "break" },
        { type: "text", text: "there", marks: [] },
      ],
    });
    assert.deepEqual(list, {
      type: "bulleted-list",
      children: [
        {
          type: "list-item",
          children: [{ type: "text", text: "Visible item", marks: [] }],
        },
      ],
    });
  });

  test("trims Unlayer's empty line breaks at rich-text paragraph edges", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "text",
                    values: {
                      text: [
                        "<p>First paragraph<br><br></p>",
                        "<p>Second paragraph<br>still the same paragraph<br><br> </p>",
                      ].join(""),
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const [text] = importedNodesByType(result, "rich-text");
    assert.deepEqual(text?.props.value.children, [
      {
        type: "paragraph",
        align: "left",
        children: [{ type: "text", text: "First paragraph", marks: [] }],
      },
      {
        type: "paragraph",
        align: "left",
        children: [
          { type: "text", text: "Second paragraph", marks: [] },
          { type: "break" },
          { type: "text", text: "still the same paragraph", marks: [] },
        ],
      },
    ]);
  });

  test("skips empty text tools and decodes serialized editor-state button labels", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  { type: "text", values: { text: "<p>&#8203;</p>" } },
                  { type: "text", values: { text: "<p><br></p>" } },
                  { type: "text", values: { text: "<p>Keep this text</p>" } },
                  {
                    type: "button",
                    values: {
                      text: JSON.stringify({
                        root: {
                          type: "root",
                          children: [
                            {
                              type: "extended-paragraph",
                              children: [
                                {
                                  type: "extended-text",
                                  text: "Ajută-ne să continuăm!",
                                  format: 1,
                                },
                              ],
                            },
                          ],
                        },
                      }),
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const textNodes = importedNodesByType(result, "rich-text");
    assert.equal(textNodes.length, 1, "empty text tools are omitted entirely");
    assert.equal(
      textNodes[0]?.props.value.children[0]?.type === "paragraph" &&
        textNodes[0].props.value.children[0].children[0]?.type === "text"
        ? textNodes[0].props.value.children[0].children[0].text
        : null,
      "Keep this text",
    );
    const [cta] = importedNodesByType(result, "cta");
    const label = cta?.props.label.children[0];
    assert.equal(
      label?.type === "paragraph" && label.children[0]?.type === "text"
        ? label.children[0].text
        : null,
      "Ajută-ne să continuăm!",
    );
    assert.equal(
      label?.type === "paragraph" && label.children[0]?.type === "text"
        ? label.children[0].marks.includes("bold")
        : false,
      true,
    );
  });

  /**
   * Both defects below imported a template that looked structurally complete —
   * right block count, no errors — while the content that makes it a
   * newsletter was gone. Neither surfaced as a failure anywhere.
   */
  test("imports body copy that Unlayer persisted only as a Lexical state", () => {
    const textJson = JSON.stringify({
      root: {
        type: "root",
        version: 1,
        children: [
          {
            type: "extended-paragraph",
            version: 1,
            children: [
              {
                type: "extended-text",
                version: 1,
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Dragă prietene, mulțumim.",
              },
            ],
          },
        ],
      },
    });
    const result = importUnlayerEmailDesign({
      body: {
        rows: [
          {
            cells: [1],
            columns: [
              { contents: [{ type: "paragraph", values: { textJson } }] },
            ],
          },
        ],
        values: {},
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(
      JSON.stringify(result.value.nodes),
      /Dragă prietene, mulțumim\./,
    );
  });

  test("keeps a button's authored URL rather than Unlayer's own placeholder", () => {
    const result = importUnlayerEmailDesign({
      body: {
        rows: [
          {
            cells: [1],
            columns: [
              {
                contents: [
                  {
                    type: "button",
                    values: {
                      text: "<span>Donate</span>",
                      href: {
                        name: "web",
                        attrs: { href: "{{href}}", target: "{{target}}" },
                        values: {
                          href: "https://donate.example.org/doneaza/",
                          target: "_blank",
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
        values: {},
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.value.nodes);
    assert.match(serialized, /https:\/\/donate\.example\.org\/doneaza\//);
    assert.doesNotMatch(serialized, /\{\{href\}\}/);
    assert.deepEqual(
      result.warnings.filter((entry) => /unsafe legacy link/i.test(entry)),
      [],
    );
  });

  test("rejects non-Unlayer input instead of creating an empty duplicate", () => {
    const result = importUnlayerEmailDesign({ body: { values: {} } });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.issues[0]?.code, "unlayer/import-invalid-design");
  });

  test("maps a legacy social block's icons, links, style, shape, and sizing", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "social",
                    values: {
                      align: "center",
                      icons: {
                        icons: [
                          {
                            url: "https://www.instagram.com/exampleorg",
                            name: "Instagram",
                          },
                          {
                            url: "https://www.tiktok.com/@exampleorg",
                            name: "TikTok",
                          },
                          {
                            // Predates the X rebrand — still seen in older templates.
                            url: "https://twitter.com/exampleorg",
                            name: "Twitter",
                          },
                          {
                            // Unrecognized legacy platform: dropped, not guessed at.
                            url: "https://plus.google.com/exampleorg",
                            name: "Google+",
                          },
                        ],
                        iconType: "circle-white",
                      },
                      spacing: 10,
                      iconSize: 25,
                      containerPadding: "10px",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    const [social] = importedNodesByType(result, "social");
    assert.ok(social, "expected a social node to be imported");
    assert.deepEqual(social?.props.items, [
      {
        id: "unlayer-social-item-1",
        platform: "instagram",
        url: "https://www.instagram.com/exampleorg",
      },
      {
        id: "unlayer-social-item-2",
        platform: "tiktok",
        url: "https://www.tiktok.com/@exampleorg",
      },
      {
        id: "unlayer-social-item-3",
        platform: "x",
        url: "https://twitter.com/exampleorg",
      },
    ]);
    assert.equal(social?.props.iconStyle, "filled");
    assert.equal(social?.props.shape, "circle");
    assert.equal(social?.props.iconSizePx, 25);
    assert.equal(social?.props.gapPx, 10);
    assert.equal(social?.props.align, "center");
    assert.ok(
      result.warnings.some((entry) => /Google\+/.test(entry)),
      "expected a warning for the unrecognized legacy platform",
    );
  });

  test("skips a legacy social block whose icons are all unrecognized", () => {
    const result = importUnlayerEmailDesign({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "social",
                    values: {
                      icons: {
                        icons: [{ url: "https://g.co/x", name: "Google+" }],
                        iconType: "circle-color",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(importedNodesByType(result, "social").length, 0);
  });
});
