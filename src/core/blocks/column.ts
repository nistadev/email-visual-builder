import type { ColumnProps } from "../../types/index.js";
import { isPlainObject } from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseBackground,
  parseOptionalSpacing,
  parseSpacing,
} from "../parse/presentation.js";

export function parseColumnProps(
  value: unknown,
  path: string,
): ParseResult<ColumnProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected column props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const background = collector.field(
    parseBackground(value.background, `${path}.background`),
    { color: null },
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
  return collector.finish({ background, spacing, margin });
}
