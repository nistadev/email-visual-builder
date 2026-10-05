import type { CtaProps, TypographyValue } from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseFiniteNumber,
  parseHexColor,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseShadow,
  parseSpacing,
  parseTypography,
  parseWidth,
} from "../parse/presentation.js";
import { parseTemplatedValue } from "../parse/templated-value.js";
import { parseRichTextValue } from "../parse/rich-text.js";

function parseCtaWidth(
  value: unknown,
  path: string,
): ParseResult<CtaProps["width"]> {
  if (isPlainObject(value) && value.unit === "auto") {
    return { ok: true, value: { unit: "auto" } };
  }
  return parseWidth(value, path) as ParseResult<CtaProps["width"]>;
}

export function parseCtaProps(
  value: unknown,
  path: string,
): ParseResult<CtaProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected CTA props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const label = collector.field(
    parseRichTextValue(value.label, `${path}.label`),
    {
      kind: "donativus.rich-text" as const,
      version: 1,
      children: [],
    },
  );
  const destination = collector.field(
    parseTemplatedValue(value.destination, `${path}.destination`),
    {
      segments: [],
    },
  );
  const typography = collector.field<TypographyValue>(
    parseTypography(value.typography, `${path}.typography`),
    {
      fontFamily: "sans-serif",
      fontSizePx: 16,
      lineHeightPercent: 130,
      letterSpacingPx: 0,
      fontWeight: "bold",
      color: "#ffffff",
    },
  );
  const backgroundColor = collector.field(
    parseHexColor(value.backgroundColor, `${path}.backgroundColor`),
    "#000000",
  );
  const align = collector.field(
    parseHorizontalAlignment(value.align, `${path}.align`),
    "left",
  );
  const width = collector.field<CtaProps["width"]>(
    parseCtaWidth(value.width, `${path}.width`),
    { unit: "auto" },
  );
  const borderRadiusPx = collector.field(
    parseFiniteNumber(value.borderRadiusPx, `${path}.borderRadiusPx`, {
      min: 0,
      max: VISUAL_DOCUMENT_LIMITS.maxBorderRadiusPx,
    }),
    0,
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
  const shadow = collector.field(
    parseShadow(value.shadow, `${path}.shadow`),
    null,
  );
  return collector.finish({
    label,
    destination,
    typography,
    backgroundColor,
    align,
    width,
    borderRadiusPx,
    spacing,
    margin,
    shadow,
  });
}
