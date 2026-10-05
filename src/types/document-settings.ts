// Mode-discriminated document settings. See design.md decisions #3 and
// #11/#12 for why mode is a strategy discriminant rather than a boolean, and
// what each renderer's settings surface must carry.

import type {
  HexColor,
  HorizontalAlignment,
  SpacingValue,
  TypographyValue,
  WidthValue,
} from "./presentation.js";

export interface VisualDocumentLinkStyle {
  color: HexColor;
  underline: boolean;
}

export interface VisualDocumentEmailSettings {
  language: string;
  previewText: string;
  canvasBackgroundColor: HexColor;
  /** Bounded by the core's documented content-width limits. */
  contentWidth: WidthValue;
  contentAlign: HorizontalAlignment;
  /** Padding inside the configured sections canvas. */
  spacing: SpacingValue;
  defaultTypography: TypographyValue;
  textColor: HexColor;
  linkStyle: VisualDocumentLinkStyle;
}

export interface VisualDocumentLandingPageSettings {
  language: string;
  title: string;
  metaDescription: string | null;
  pageBackgroundColor: HexColor;
  contentWidth: WidthValue;
  contentAlign: HorizontalAlignment;
  /** Padding inside the configured sections canvas. */
  spacing: SpacingValue;
  defaultTypography: TypographyValue;
  textColor: HexColor;
  linkStyle: VisualDocumentLinkStyle;
  /** Must pass image-URL validation when present. */
  faviconUrl: string | null;
}
