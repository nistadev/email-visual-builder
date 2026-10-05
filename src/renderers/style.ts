// Deterministic style-entry builders over validated presentation values
// (task 8.1). These turn a `TypographyValue`/`SpacingValue`/etc. into
// ordered `StyleEntry` pairs for `serializeInlineStyle` — mode renderers
// (sections 9-10) compose them rather than hand-writing property lists.

import type {
  BackgroundValue,
  BorderValue,
  ShadowValue,
  SpacingValue,
  TypographyValue,
  WidthValue,
} from "../types/index.js";
import type { StyleEntry } from "./escape.js";

const FONT_WEIGHT_VALUES: Record<TypographyValue["fontWeight"], string> = {
  thin: "100",
  normal: "400",
  semibold: "600",
  bold: "700",
};

export function typographyStyleEntries(value: TypographyValue): StyleEntry[] {
  return [
    ["font-family", value.fontFamily],
    ["font-size", `${value.fontSizePx}px`],
    ["line-height", `${value.lineHeightPercent}%`],
    ["letter-spacing", `${value.letterSpacingPx}px`],
    ["font-weight", FONT_WEIGHT_VALUES[value.fontWeight]],
    ["color", value.color],
  ];
}

/** Spacing is internal block padding; external block separation uses `marginStyleEntries` or an email-safe wrapper. */
export function spacingStyleEntries(value: SpacingValue): StyleEntry[] {
  return [
    ["padding-top", `${value.topPx}px`],
    ["padding-right", `${value.rightPx}px`],
    ["padding-bottom", `${value.bottomPx}px`],
    ["padding-left", `${value.leftPx}px`],
  ];
}

export function marginStyleEntries(value: SpacingValue): StyleEntry[] {
  return [
    ["margin-top", `${value.topPx}px`],
    ["margin-right", `${value.rightPx}px`],
    ["margin-bottom", `${value.bottomPx}px`],
    ["margin-left", `${value.leftPx}px`],
  ];
}

export function shadowStyleValue(value: ShadowValue): string {
  return `${value.offsetXPx}px ${value.offsetYPx}px ${value.blurPx}px ${value.spreadPx}px ${value.color}`;
}

export function shadowStyleEntries(value: ShadowValue | null): StyleEntry[] {
  return value ? [["box-shadow", shadowStyleValue(value)]] : [];
}

export function backgroundStyleEntries(value: BackgroundValue): StyleEntry[] {
  return [["background-color", value.color]];
}

export function borderStyleEntries(value: BorderValue): StyleEntry[] {
  if (value.style === "none" || value.widthPx === 0) {
    return [["border", "none"]];
  }
  return [
    ["border-width", `${value.widthPx}px`],
    ["border-style", value.style],
    ["border-color", value.color],
    ["border-radius", `${value.radiusPx}px`],
  ];
}

export function widthStyleEntries(value: WidthValue): StyleEntry[] {
  return [
    ["width", value.unit === "px" ? `${value.value}px` : `${value.value}%`],
  ];
}
