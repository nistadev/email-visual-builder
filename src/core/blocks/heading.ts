import type {
  HeadingLevel,
  HeadingProps,
  TypographyValue,
} from "../../types/index.js";
import { isPlainObject } from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseSpacing,
  parseTypography,
} from "../parse/presentation.js";
import { parseRichTextValue } from "../parse/rich-text.js";

const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];

function parseHeadingLevel(value: unknown): HeadingLevel | null {
  return typeof value === "number" &&
    HEADING_LEVELS.includes(value as HeadingLevel)
    ? (value as HeadingLevel)
    : null;
}

export function parseHeadingProps(
  value: unknown,
  path: string,
): ParseResult<HeadingProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected heading props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();

  const level = parseHeadingLevel(value.level);
  if (level === null) {
    collector.push(
      issue(
        "value/invalid-heading-level",
        `"${path}.level" must be 1 through 6.`,
        { path: `${path}.level` },
      ),
    );
  }

  const text = collector.field(parseRichTextValue(value.text, `${path}.text`), {
    kind: "donativus.rich-text" as const,
    version: 1,
    children: [],
  });
  const typography = collector.field<TypographyValue>(
    parseTypography(value.typography, `${path}.typography`),
    {
      fontFamily: "sans-serif",
      fontSizePx: 24,
      lineHeightPercent: 130,
      letterSpacingPx: 0,
      fontWeight: "bold",
      color: "#000000",
    },
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
  const align = collector.field(
    parseHorizontalAlignment(value.align, `${path}.align`),
    "left",
  );

  return collector.finish({
    level: level ?? 1,
    text,
    typography,
    spacing,
    margin,
    align,
  });
}
