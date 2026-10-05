import type { RichTextProps, TypographyValue } from "../../types/index.js";
import {
  isPlainObject,
  parseBoolean,
  parseFiniteNumber,
  parseHexColor,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseOptionalSpacing,
  parseSpacing,
  parseTypography,
} from "../parse/presentation.js";
import { parseRichTextValue } from "../parse/rich-text.js";

export function parseRichTextBlockProps(
  value: unknown,
  path: string,
): ParseResult<RichTextProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected rich-text props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const richTextValue = collector.field(
    parseRichTextValue(value.value, `${path}.value`),
    {
      kind: "donativus.rich-text" as const,
      version: 1,
      children: [],
    },
  );
  const typography = collector.field<TypographyValue>(
    parseTypography(value.typography, `${path}.typography`),
    {
      fontFamily: "sans-serif",
      fontSizePx: 16,
      lineHeightPercent: 150,
      letterSpacingPx: 0,
      fontWeight: "normal",
      color: "#000000",
    },
  );
  const border = collector.field(
    parseBoolean(value.border ?? false, `${path}.border`),
    false,
  );
  const borderWidth = collector.field(
    parseFiniteNumber(value.borderWidth ?? 1, `${path}.borderWidth`, {
      min: 0,
      max: 40,
    }),
    1,
  );
  const borderColor = collector.field(
    parseHexColor(value.borderColor ?? "#000000", `${path}.borderColor`),
    "#000000",
  );
  const borderRadiusPx = collector.field(
    parseFiniteNumber(value.borderRadiusPx ?? 0, `${path}.borderRadiusPx`, {
      min: 0,
      max: 100,
    }),
    0,
  );
  const borderRadiusByCorner = collector.field(
    parseBoolean(
      value.borderRadiusByCorner ?? false,
      `${path}.borderRadiusByCorner`,
    ),
    false,
  );
  const parseRadius = (key: string) =>
    collector.field(
      parseFiniteNumber(value[key] ?? borderRadiusPx, `${path}.${key}`, {
        min: 0,
        max: 100,
      }),
      borderRadiusPx,
    );
  const borderTopLeftRadiusPx = parseRadius("borderTopLeftRadiusPx");
  const borderTopRightRadiusPx = parseRadius("borderTopRightRadiusPx");
  const borderBottomRightRadiusPx = parseRadius("borderBottomRightRadiusPx");
  const borderBottomLeftRadiusPx = parseRadius("borderBottomLeftRadiusPx");
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
    value: richTextValue,
    typography,
    border,
    borderWidth,
    borderColor,
    borderRadiusPx,
    borderRadiusByCorner,
    borderTopLeftRadiusPx,
    borderTopRightRadiusPx,
    borderBottomRightRadiusPx,
    borderBottomLeftRadiusPx,
    spacing,
    margin,
  });
}
