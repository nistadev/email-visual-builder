// Built-in block node/property contracts. Version 1 structural rule: the
// document root is a dedicated `document-root` node that accepts only
// `section` children; `section` accepts content blocks and `columns`;
// `columns` owns one-to-four `column`s; `column` accepts content blocks but
// not `section`/`columns`. See design.md decision #6 — enforced at runtime
// by the core registry, not by these types.

import type { VisualBuilderImageAsset } from "./assets.js";
import type { VisualDocumentNode } from "./document-node.js";
import type {
  BackgroundValue,
  HexColor,
  HorizontalAlignment,
  ResponsiveStackBehavior,
  ShadowValue,
  SpacingValue,
  TypographyValue,
  WidthValue,
} from "./presentation.js";
import type { RichTextValue } from "./rich-text.js";
import type { TemplatedValue } from "./variables.js";

/** Purely structural — carries no presentation data of its own (that's `section`'s job). */
export type DocumentRootProps = Record<string, never>;
export type DocumentRootNode = VisualDocumentNode<
  "document-root",
  DocumentRootProps
>;

export interface SectionProps {
  background: BackgroundValue;
  contentWidth: WidthValue;
  spacing: SpacingValue;
  margin: SpacingValue;
  align: HorizontalAlignment;
  shadow: ShadowValue | null;
}
export type SectionNode = VisualDocumentNode<"section", SectionProps>;

export interface ColumnsProps {
  /** One to four ratio values that sum to 100; length is the column count. */
  columnWidthRatios: number[];
  responsiveStack: ResponsiveStackBehavior;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type ColumnsNode = VisualDocumentNode<"columns", ColumnsProps>;

export interface ColumnProps {
  background: BackgroundValue;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type ColumnNode = VisualDocumentNode<"column", ColumnProps>;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps {
  level: HeadingLevel;
  text: RichTextValue;
  typography: TypographyValue;
  spacing: SpacingValue;
  margin: SpacingValue;
  align: HorizontalAlignment;
}
export type HeadingNode = VisualDocumentNode<"heading", HeadingProps>;

export interface RichTextProps {
  value: RichTextValue;
  typography: TypographyValue;
  border: boolean;
  borderWidth: number;
  borderColor: string;
  borderRadiusPx: number;
  borderRadiusByCorner: boolean;
  borderTopLeftRadiusPx: number;
  borderTopRightRadiusPx: number;
  borderBottomRightRadiusPx: number;
  borderBottomLeftRadiusPx: number;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type RichTextNode = VisualDocumentNode<"rich-text", RichTextProps>;

export interface ImageProps {
  asset: VisualBuilderImageAsset | null;
  altText: string;
  displayWidth: WidthValue;
  align: HorizontalAlignment;
  link: TemplatedValue | null;
  borderRadiusPx: number;
  borderRadiusByCorner: boolean;
  borderTopLeftRadiusPx: number;
  borderTopRightRadiusPx: number;
  borderBottomRightRadiusPx: number;
  borderBottomLeftRadiusPx: number;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type ImageNode = VisualDocumentNode<"image", ImageProps>;

export interface CtaProps {
  label: RichTextValue;
  destination: TemplatedValue;
  typography: TypographyValue;
  backgroundColor: string;
  align: HorizontalAlignment;
  width: WidthValue | { unit: "auto" };
  borderRadiusPx: number;
  spacing: SpacingValue;
  margin: SpacingValue;
  shadow: ShadowValue | null;
}
export type CtaNode = VisualDocumentNode<"cta", CtaProps>;

export type DividerStyle = "solid" | "dashed" | "dotted";

export interface DividerProps {
  color: string;
  thicknessPx: number;
  width: WidthValue;
  align: HorizontalAlignment;
  style: DividerStyle;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type DividerNode = VisualDocumentNode<"divider", DividerProps>;

export interface SpacerProps {
  /** Bounded by the core's documented height limit. */
  heightPx: number;
  width: WidthValue;
  align: HorizontalAlignment;
  margin: SpacingValue;
}
export type SpacerNode = VisualDocumentNode<"spacer", SpacerProps>;

/** Built-in social platforms — see `social-icon-assets.generated.ts` for the bundled icon set backing each. */
export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "x"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "whatsapp"
  | "website"
  | "email";

export interface SocialLinkItem {
  id: string;
  platform: SocialPlatform;
  /** Plain URL (or `mailto:`/`tel:`) — social links don't carry template variables. */
  url: string;
}

/**
 * `logo` — full brand-color glyph, no background (the multicolor mark as-is).
 * `filled` — a mono glyph over a shape filled with that platform's own brand
 * color (the original/default look).
 * `filled-color` — a mono glyph over a shape filled with one custom color
 * shared by every item (`color`).
 * `no-color` — the mono glyph alone, no background shape.
 */
export type SocialIconStyle = "logo" | "filled" | "filled-color" | "no-color";
export type SocialIconShape = "circle" | "square" | "rounded";
/** Which baked mono glyph to use — irrelevant for `logo`/`filled`, which always use `light` and the platform's own brand color respectively. */
export type SocialGlyphTone = "light" | "dark";

export interface SocialProps {
  items: SocialLinkItem[];
  iconStyle: SocialIconStyle;
  /** Meaningful when `iconStyle` is `filled` or `filled-color` (there's a shape to round). */
  shape: SocialIconShape;
  /** The shared background for `filled-color`. Ignored by every other style. */
  color: HexColor;
  /** The glyph's light/dark rendition for `filled-color` and `no-color`. Ignored by `logo` (always full-color) and `filled` (always `light`, for contrast against the brand-color shape). */
  glyphTone: SocialGlyphTone;
  iconSizePx: number;
  gapPx: number;
  align: HorizontalAlignment;
  spacing: SpacingValue;
  margin: SpacingValue;
}
export type SocialNode = VisualDocumentNode<"social", SocialProps>;

export type VisualBuilderBuiltInNode =
  | DocumentRootNode
  | SectionNode
  | ColumnsNode
  | ColumnNode
  | HeadingNode
  | RichTextNode
  | ImageNode
  | CtaNode
  | DividerNode
  | SpacerNode
  | SocialNode;

export type VisualBuilderBuiltInNodeType = VisualBuilderBuiltInNode["type"];
