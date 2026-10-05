/**
 * Raw (untyped, as-if-from-JSON) visual-document fixtures for core parser
 * tests. Deliberately plain `Record<string, unknown>` — parser tests feed
 * untrusted input, not already-typed `VisualDocument` values.
 */

const SPACING = { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 };
const TYPOGRAPHY = {
  fontFamily: "Arial, sans-serif",
  fontSizePx: 16,
  lineHeightPercent: 150,
  letterSpacingPx: 0,
  fontWeight: "normal",
  color: "#333333",
};

/**
 * `root` (id `"root"`) is the dedicated `document-root` node — it only ever
 * accepts `section` children — and `section-1` is the actual section
 * holding content blocks. Tests that insert/move *content* blocks target
 * `"section-1"`; tests exercising root protection (cannot remove/move/
 * duplicate, root-only block placement) target `"root"`.
 */
export function createValidEmailDocumentInput(): Record<string, unknown> {
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
        children: ["heading-1", "rich-text-1"],
        props: {
          background: { color: "#ffffff" },
          contentWidth: { unit: "px", value: 600 },
          spacing: SPACING,
          margin: SPACING,
          align: "left",
          shadow: null,
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
                children: [{ type: "text", text: "Thank you", marks: [] }],
              },
            ],
          },
          typography: { ...TYPOGRAPHY, fontSizePx: 24, fontWeight: "bold" },
          spacing: SPACING,
          margin: SPACING,
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
                  { type: "text", text: "Every gift matters.", marks: [] },
                ],
              },
            ],
          },
          typography: TYPOGRAPHY,
          spacing: SPACING,
          margin: SPACING,
        },
      },
    },
    settings: {
      language: "en",
      previewText: "Every gift matters.",
      canvasBackgroundColor: "#f4f4f4",
      contentWidth: { unit: "px", value: 600 },
      spacing: SPACING,
      defaultTypography: TYPOGRAPHY,
      textColor: "#333333",
      linkStyle: { color: "#1a73e8", underline: true },
    },
  };
}

/** Deep clone via JSON round-trip, simulating input that actually crossed a JSON boundary. */
export function cloneAsJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
