import type {
  BackgroundValue,
  BorderStyle,
  BorderValue,
  HorizontalAlignment,
  ResponsiveStackBehavior,
  ShadowValue,
  SpacingValue,
  TypographyValue,
  VerticalAlignment,
  WidthValue,
} from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseEnum,
  parseFiniteNumber,
  parseHexColor,
  parseNullableHexColor,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";

const HORIZONTAL_ALIGNMENTS: readonly HorizontalAlignment[] = [
  "left",
  "center",
  "right",
];
const VERTICAL_ALIGNMENTS: readonly VerticalAlignment[] = [
  "top",
  "middle",
  "bottom",
];
const BORDER_STYLES: readonly BorderStyle[] = [
  "none",
  "solid",
  "dashed",
  "dotted",
];
const RESPONSIVE_STACK_BEHAVIORS: readonly ResponsiveStackBehavior[] = [
  "stack",
  "no-stack",
];

export function parseHorizontalAlignment(
  value: unknown,
  path: string,
): ParseResult<HorizontalAlignment> {
  return parseEnum(value, HORIZONTAL_ALIGNMENTS, path);
}

export function parseVerticalAlignment(
  value: unknown,
  path: string,
): ParseResult<VerticalAlignment> {
  return parseEnum(value, VERTICAL_ALIGNMENTS, path);
}

export function parseResponsiveStackBehavior(
  value: unknown,
  path: string,
): ParseResult<ResponsiveStackBehavior> {
  return parseEnum(value, RESPONSIVE_STACK_BEHAVIORS, path);
}

export function parseSpacing(
  value: unknown,
  path: string,
): ParseResult<SpacingValue> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a spacing object at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const bound = { min: 0, max: VISUAL_DOCUMENT_LIMITS.maxSpacingPx };
  const topPx = collector.field(
    parseFiniteNumber(value.topPx, `${path}.topPx`, bound),
    0,
  );
  const rightPx = collector.field(
    parseFiniteNumber(value.rightPx, `${path}.rightPx`, bound),
    0,
  );
  const bottomPx = collector.field(
    parseFiniteNumber(value.bottomPx, `${path}.bottomPx`, bound),
    0,
  );
  const leftPx = collector.field(
    parseFiniteNumber(value.leftPx, `${path}.leftPx`, bound),
    0,
  );
  return collector.finish({ topPx, rightPx, bottomPx, leftPx });
}

/** New v1 fields may be absent in local development fixtures; parsed documents always receive a canonical zero value. */
export function parseOptionalSpacing(
  value: unknown,
  path: string,
): ParseResult<SpacingValue> {
  return value === undefined
    ? {
        ok: true,
        value: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      }
    : parseSpacing(value, path);
}

export function parseShadow(
  value: unknown,
  path: string,
): ParseResult<ShadowValue | null> {
  if (value === null) return { ok: true, value: null };
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a shadow object at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const signedBound = {
    min: -VISUAL_DOCUMENT_LIMITS.maxShadowPx,
    max: VISUAL_DOCUMENT_LIMITS.maxShadowPx,
  };
  const offsetXPx = collector.field(
    parseFiniteNumber(value.offsetXPx, `${path}.offsetXPx`, signedBound),
    0,
  );
  const offsetYPx = collector.field(
    parseFiniteNumber(value.offsetYPx, `${path}.offsetYPx`, signedBound),
    0,
  );
  const blurPx = collector.field(
    parseFiniteNumber(value.blurPx, `${path}.blurPx`, {
      min: 0,
      max: VISUAL_DOCUMENT_LIMITS.maxShadowPx,
    }),
    0,
  );
  const spreadPx = collector.field(
    parseFiniteNumber(value.spreadPx, `${path}.spreadPx`, signedBound),
    0,
  );
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#00000033",
  );
  return collector.finish({ offsetXPx, offsetYPx, blurPx, spreadPx, color });
}

export function parseWidth(
  value: unknown,
  path: string,
): ParseResult<WidthValue> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a width object at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const unit = collector.field(
    parseEnum(value.unit, ["px", "percent"] as const, `${path}.unit`),
    "px" as const,
  );
  const max = unit === "percent" ? 100 : VISUAL_DOCUMENT_LIMITS.maxDimensionPx;
  const numericValue = collector.field(
    parseFiniteNumber(value.value, `${path}.value`, { min: 0, max }),
    0,
  );
  return collector.finish({ unit, value: numericValue } as WidthValue);
}

export function parseTypography(
  value: unknown,
  path: string,
): ParseResult<TypographyValue> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a typography object at "${path}".`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const fontFamily = collector.field(
    parseString(value.fontFamily, `${path}.fontFamily`, {
      allowEmpty: false,
      maxLength: 200,
    }),
    "sans-serif",
  );
  const fontSizePx = collector.field(
    parseFiniteNumber(value.fontSizePx, `${path}.fontSizePx`, {
      min: 1,
      max: 200,
    }),
    16,
  );
  const lineHeightPercent = collector.field(
    parseFiniteNumber(value.lineHeightPercent, `${path}.lineHeightPercent`, {
      min: 50,
      max: 400,
    }),
    150,
  );
  const letterSpacingPx = collector.field(
    parseFiniteNumber(value.letterSpacingPx, `${path}.letterSpacingPx`, {
      min: -10,
      max: 50,
    }),
    0,
  );
  const fontWeight = collector.field(
    parseEnum(
      value.fontWeight,
      ["thin", "normal", "semibold", "bold"] as const,
      `${path}.fontWeight`,
    ),
    "normal" as const,
  );
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#000000",
  );
  return collector.finish({
    fontFamily,
    fontSizePx,
    lineHeightPercent,
    letterSpacingPx,
    fontWeight,
    color,
  });
}

export function parseBorder(
  value: unknown,
  path: string,
): ParseResult<BorderValue> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a border object at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const widthPx = collector.field(
    parseFiniteNumber(value.widthPx, `${path}.widthPx`, { min: 0, max: 40 }),
    0,
  );
  const style = collector.field(
    parseEnum(value.style, BORDER_STYLES, `${path}.style`),
    "none" as const,
  );
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#000000",
  );
  const radiusPx = collector.field(
    parseFiniteNumber(value.radiusPx, `${path}.radiusPx`, {
      min: 0,
      max: VISUAL_DOCUMENT_LIMITS.maxBorderRadiusPx,
    }),
    0,
  );
  return collector.finish({ widthPx, style, color, radiusPx });
}

export function parseBackground(
  value: unknown,
  path: string,
): ParseResult<BackgroundValue> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a background object at "${path}".`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const color = collector.field(
    parseNullableHexColor(value.color, `${path}.color`),
    null,
  );
  return collector.finish({ color });
}
