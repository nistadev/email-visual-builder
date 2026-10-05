import type { SpacerProps, WidthValue } from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import { isPlainObject, parseFiniteNumber } from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseWidth,
} from "../parse/presentation.js";

export function parseSpacerProps(
  value: unknown,
  path: string,
): ParseResult<SpacerProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected spacer props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const heightPx = collector.field(
    parseFiniteNumber(value.heightPx, `${path}.heightPx`, {
      min: 0,
      max: VISUAL_DOCUMENT_LIMITS.maxDimensionPx,
    }),
    16,
  );
  const width =
    value.width === undefined
      ? ({ unit: "percent", value: 100 } as WidthValue)
      : collector.field<WidthValue>(parseWidth(value.width, `${path}.width`), {
          unit: "percent",
          value: 100,
        });
  const align =
    value.align === undefined
      ? "left"
      : collector.field(
          parseHorizontalAlignment(value.align, `${path}.align`),
          "left",
        );
  const margin = collector.field(
    parseOptionalSpacing(value.margin, `${path}.margin`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  return collector.finish({ heightPx, width, align, margin });
}
