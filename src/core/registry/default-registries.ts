// Wires the section-3 built-in parsers into real `BlockDefinition`/
// `ModeDefinition` instances so `parseVisualDocument` works out of the box
// without every consumer hand-building a registry. `document-root` is the
// only block type allowed at a document's `rootId` position; `section` may
// only be parented by it — see design.md decision #6 and task 6.2.

import type {
  RichTextValue,
  SpacingValue,
  TypographyValue,
  VisualDocumentMode,
} from "../../types/index.js";
import { parseColumnProps } from "../blocks/column.js";
import { parseColumnsProps } from "../blocks/columns.js";
import { parseCtaProps } from "../blocks/cta.js";
import { parseDividerProps } from "../blocks/divider.js";
import { parseDocumentRootProps } from "../blocks/document-root.js";
import { parseHeadingProps } from "../blocks/heading.js";
import { parseImageProps } from "../blocks/image.js";
import { parseRichTextBlockProps } from "../blocks/rich-text-block.js";
import { parseSectionProps } from "../blocks/section.js";
import { parseSocialProps } from "../blocks/social.js";
import { parseSpacerProps } from "../blocks/spacer.js";
import {
  parseEmailSettings,
  parseLandingPageSettings,
} from "../parse/document-settings.js";
import { CURRENT_BLOCK_VERSIONS } from "../versions.js";
import { createBlockRegistry } from "./block-registry.js";
import { createBuilderRegistries } from "./builder-registries.js";
import { createInspectorControlRegistry } from "./inspector-control-registry.js";
import { createModeRegistry } from "./mode-registry.js";
import { createVariableRegistry } from "./variable-registry.js";
import type {
  BlockDefinition,
  BuilderRegistries,
  ModeDefinition,
} from "./types.js";

const BOTH_MODES: readonly VisualDocumentMode[] = ["email", "landing-page"];
const NO_SPACING: SpacingValue = {
  topPx: 0,
  rightPx: 0,
  bottomPx: 0,
  leftPx: 0,
};
const DEFAULT_SECTION_SPACING: SpacingValue = {
  topPx: 20,
  rightPx: 20,
  bottomPx: 20,
  leftPx: 20,
};
const DEFAULT_DOCUMENT_SPACING: SpacingValue = DEFAULT_SECTION_SPACING;
const DEFAULT_CTA_PADDING: SpacingValue = {
  topPx: 12,
  rightPx: 24,
  bottomPx: 12,
  leftPx: 24,
};
const DEFAULT_DIVIDER_PADDING: SpacingValue = {
  topPx: 10,
  rightPx: 10,
  bottomPx: 10,
  leftPx: 10,
};
const BODY_TYPOGRAPHY: TypographyValue = {
  fontFamily: "Arial, sans-serif",
  fontSizePx: 16,
  lineHeightPercent: 150,
  letterSpacingPx: 0,
  fontWeight: "normal",
  color: "#333333",
};
function defaultTextValue(text: string): RichTextValue {
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
const DEFAULT_HEADING_TEXT = defaultTextValue("Heading");
const DEFAULT_RICH_TEXT = defaultTextValue("Write your text here.");
const DEFAULT_CTA_LABEL = defaultTextValue("Button");

const BUILT_IN_BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  {
    type: "document-root",
    version: CURRENT_BLOCK_VERSIONS["document-root"],
    supportedModes: BOTH_MODES,
    isContainer: true,
    allowedParentTypes: null,
    allowedChildTypes: ["section"],
    defaultProps: () => ({}),
    parseProps: parseDocumentRootProps,
  },
  {
    type: "section",
    version: CURRENT_BLOCK_VERSIONS.section,
    supportedModes: BOTH_MODES,
    isContainer: true,
    allowedParentTypes: ["document-root"],
    allowedChildTypes: [
      "heading",
      "rich-text",
      "image",
      "cta",
      "divider",
      "spacer",
      "columns",
      "social",
    ],
    defaultProps: () => ({
      background: { color: "#ffffff" },
      contentWidth: { unit: "px", value: 600 },
      spacing: DEFAULT_SECTION_SPACING,
      margin: NO_SPACING,
      align: "left",
      shadow: null,
    }),
    parseProps: parseSectionProps,
  },
  {
    type: "columns",
    version: CURRENT_BLOCK_VERSIONS.columns,
    supportedModes: BOTH_MODES,
    isContainer: true,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: ["column"],
    defaultProps: () => ({
      columnWidthRatios: [50, 50],
      responsiveStack: "stack",
      spacing: NO_SPACING,
      margin: NO_SPACING,
    }),
    defaultChildren: () => [{ type: "column" }, { type: "column" }],
    parseProps: parseColumnsProps,
  },
  {
    type: "column",
    version: CURRENT_BLOCK_VERSIONS.column,
    supportedModes: BOTH_MODES,
    isContainer: true,
    allowedParentTypes: ["columns"],
    allowedChildTypes: [
      "heading",
      "rich-text",
      "image",
      "cta",
      "divider",
      "spacer",
      "columns",
      "social",
    ],
    defaultProps: () => ({
      background: { color: null },
      spacing: NO_SPACING,
      margin: NO_SPACING,
    }),
    parseProps: parseColumnProps,
  },
  {
    type: "heading",
    version: CURRENT_BLOCK_VERSIONS.heading,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      level: 2,
      text: DEFAULT_HEADING_TEXT,
      typography: { ...BODY_TYPOGRAPHY, fontSizePx: 24, fontWeight: "bold" },
      spacing: NO_SPACING,
      margin: NO_SPACING,
      align: "left",
    }),
    parseProps: parseHeadingProps,
  },
  {
    type: "rich-text",
    version: CURRENT_BLOCK_VERSIONS["rich-text"],
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      value: DEFAULT_RICH_TEXT,
      typography: BODY_TYPOGRAPHY,
      border: false,
      borderWidth: 1,
      borderColor: "#000000",
      borderRadiusPx: 0,
      borderRadiusByCorner: false,
      borderTopLeftRadiusPx: 0,
      borderTopRightRadiusPx: 0,
      borderBottomRightRadiusPx: 0,
      borderBottomLeftRadiusPx: 0,
      spacing: NO_SPACING,
      margin: NO_SPACING,
    }),
    parseProps: parseRichTextBlockProps,
  },
  {
    type: "image",
    version: CURRENT_BLOCK_VERSIONS.image,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      asset: null,
      altText: "",
      displayWidth: { unit: "percent", value: 100 },
      align: "left",
      link: null,
      borderRadiusPx: 0,
      borderRadiusByCorner: false,
      borderTopLeftRadiusPx: 0,
      borderTopRightRadiusPx: 0,
      borderBottomRightRadiusPx: 0,
      borderBottomLeftRadiusPx: 0,
      spacing: NO_SPACING,
      margin: NO_SPACING,
    }),
    parseProps: parseImageProps,
  },
  {
    type: "cta",
    version: CURRENT_BLOCK_VERSIONS.cta,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      label: DEFAULT_CTA_LABEL,
      destination: { segments: [] },
      typography: { ...BODY_TYPOGRAPHY, fontWeight: "bold", color: "#ffffff" },
      backgroundColor: "#000000",
      align: "left",
      width: { unit: "auto" },
      borderRadiusPx: 4,
      spacing: DEFAULT_CTA_PADDING,
      margin: NO_SPACING,
      shadow: null,
    }),
    parseProps: parseCtaProps,
  },
  {
    type: "divider",
    version: CURRENT_BLOCK_VERSIONS.divider,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      color: "#cccccc",
      thicknessPx: 1,
      width: { unit: "percent", value: 100 },
      align: "center",
      style: "solid",
      spacing: DEFAULT_DIVIDER_PADDING,
      margin: NO_SPACING,
    }),
    parseProps: parseDividerProps,
  },
  {
    type: "spacer",
    version: CURRENT_BLOCK_VERSIONS.spacer,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      heightPx: 16,
      width: { unit: "percent", value: 100 },
      align: "left",
      margin: NO_SPACING,
    }),
    parseProps: parseSpacerProps,
  },
  {
    type: "social",
    version: CURRENT_BLOCK_VERSIONS.social,
    supportedModes: BOTH_MODES,
    isContainer: false,
    allowedParentTypes: ["section", "column"],
    allowedChildTypes: null,
    defaultProps: () => ({
      items: [
        { id: "item-1", platform: "facebook", url: "" },
        { id: "item-2", platform: "instagram", url: "" },
        { id: "item-3", platform: "x", url: "" },
      ],
      iconStyle: "logo",
      shape: "circle",
      color: "#000000",
      glyphTone: "light",
      iconSizePx: 32,
      gapPx: 8,
      align: "center",
      spacing: NO_SPACING,
      margin: NO_SPACING,
    }),
    parseProps: parseSocialProps,
  },
];

const EMAIL_MODE_DEFINITION: ModeDefinition = {
  mode: "email",
  defaultSettings: {
    language: "en",
    previewText: "",
    canvasBackgroundColor: "#ffffff",
    contentWidth: { unit: "px", value: 600 },
    contentAlign: "center",
    spacing: DEFAULT_DOCUMENT_SPACING,
    defaultTypography: BODY_TYPOGRAPHY,
    textColor: "#333333",
    linkStyle: { color: "#1a73e8", underline: true },
  },
  parseSettings: parseEmailSettings,
};

const LANDING_PAGE_MODE_DEFINITION: ModeDefinition = {
  mode: "landing-page",
  defaultSettings: {
    language: "en",
    title: "Untitled page",
    metaDescription: null,
    pageBackgroundColor: "#ffffff",
    contentWidth: { unit: "px", value: 960 },
    contentAlign: "center",
    spacing: DEFAULT_DOCUMENT_SPACING,
    defaultTypography: BODY_TYPOGRAPHY,
    textColor: "#333333",
    linkStyle: { color: "#1a73e8", underline: true },
    faviconUrl: null,
  },
  parseSettings: parseLandingPageSettings,
};

function buildDefaultRegistries(): BuilderRegistries {
  const blocksResult = createBlockRegistry(BUILT_IN_BLOCK_DEFINITIONS);
  const modesResult = createModeRegistry([
    EMAIL_MODE_DEFINITION,
    LANDING_PAGE_MODE_DEFINITION,
  ]);
  const variablesResult = createVariableRegistry([]);
  const inspectorControlsResult = createInspectorControlRegistry([]);

  if (
    !blocksResult.ok ||
    !modesResult.ok ||
    !variablesResult.ok ||
    !inspectorControlsResult.ok
  ) {
    throw new Error(
      "Failed to construct the built-in visual-builder registries.",
    );
  }

  const combined = createBuilderRegistries({
    blocks: blocksResult.value,
    modes: modesResult.value,
    variables: variablesResult.value,
    inspectorControls: inspectorControlsResult.value,
  });
  if (!combined.ok) {
    throw new Error(
      `Built-in visual-builder registries are internally inconsistent: ${combined.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return combined.value;
}

/** The zero-config registry set: all 9 built-in blocks, both modes, no variables/inspector controls. */
export const DEFAULT_BUILDER_REGISTRIES: BuilderRegistries =
  buildDefaultRegistries();
