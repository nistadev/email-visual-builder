// Reusable, validated presentation-value primitives shared across built-in
// visual-builder blocks and mode document settings. These are structured
// values, never raw CSS/class strings — the visual-builder core parser
// validates bounds (dimensions, color format, etc.) at runtime.

/** `#RRGGBB` or `#RRGGBBAA`. */
export type HexColor = string;

export interface SpacingValue {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
}

/** A structured CSS-compatible drop shadow; `null` on a block means no shadow. */
export interface ShadowValue {
  offsetXPx: number;
  offsetYPx: number;
  blurPx: number;
  spreadPx: number;
  color: HexColor;
}

export type HorizontalAlignment = "left" | "center" | "right";
export type VerticalAlignment = "top" | "middle" | "bottom";

export interface TypographyValue {
  fontFamily: string;
  fontSizePx: number;
  lineHeightPercent: number;
  letterSpacingPx: number;
  fontWeight: "thin" | "normal" | "semibold" | "bold";
  color: HexColor;
}

export type BorderStyle = "none" | "solid" | "dashed" | "dotted";

export interface BorderValue {
  widthPx: number;
  style: BorderStyle;
  color: HexColor;
  radiusPx: number;
}

export interface BackgroundValue {
  color: HexColor | null;
}

export type WidthValue =
  { unit: "px"; value: number } | { unit: "percent"; value: number };

/** How a `columns` block behaves at narrow email/landing viewport widths. */
export type ResponsiveStackBehavior = "stack" | "no-stack";
