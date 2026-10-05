import type { DividerProps, DividerStyle, WidthValue } from "../../types/index.js";
import {
  isPlainObject,
  parseEnum,
  parseFiniteNumber,
  parseHexColor,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseSpacing,
  parseWidth,
} from "../parse/presentation.js";

const DIVIDER_STYLES: readonly DividerStyle[] = ["solid", "dashed", "dotted"];

export function parseDividerProps(
  value: unknown,
  path: string,
): ParseResult<DividerProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected divider props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#cccccc",
  );
  const thicknessPx = collector.field(
    parseFiniteNumber(value.thicknessPx, `${path}.thicknessPx`, {
      min: 1,
      max: 20,
    }),
    1,
  );
  const width = collector.field<WidthValue>(
    parseWidth(value.width, `${path}.width`),
    { unit: "percent", value: 100 },
  );
  const align =
    value.align === undefined
      ? "center"
      : collector.field(
          parseHorizontalAlignment(value.align, `${path}.align`),
          "center",
        );
  const style = collector.field(
    parseEnum(value.style, DIVIDER_STYLES, `${path}.style`),
    "solid" as const,
  );
  const spacing = collector.field(
    parseSpacing(value.spacing, `${path}.spacing`),
    {
      topPx: 0,
      rightPx: 0,
      bottomPx: 0,
      leftPx: 0,
    },
  );
  const margin = collector.field(
    parseOptionalSpacing(value.margin, `${path}.margin`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  return collector.finish({
    color,
    thicknessPx,
    width,
    align,
    style,
    spacing,
    margin,
  });
}
