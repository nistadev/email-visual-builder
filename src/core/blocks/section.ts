import type { SectionProps, WidthValue } from "../../types/index.js";
import { isPlainObject } from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseBackground,
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseShadow,
  parseSpacing,
  parseWidth,
} from "../parse/presentation.js";

export function parseSectionProps(
  value: unknown,
  path: string,
): ParseResult<SectionProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected section props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const background = collector.field(
    parseBackground(value.background, `${path}.background`),
    { color: null },
  );
  const contentWidth = collector.field<WidthValue>(
    parseWidth(value.contentWidth, `${path}.contentWidth`),
    {
      unit: "px",
      value: 600,
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
  const shadow = collector.field(
    parseShadow(value.shadow, `${path}.shadow`),
    null,
  );
  return collector.finish({
    background,
    contentWidth,
    spacing,
    margin,
    align,
    shadow,
  });
}
