import type { ColumnsProps } from "../../types/index.js";
import { isPlainObject, parseArray, parseFiniteNumber } from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseOptionalSpacing,
  parseResponsiveStackBehavior,
  parseSpacing,
} from "../parse/presentation.js";

function parseColumnWidthRatios(
  value: unknown,
  path: string,
): number[] | undefined {
  const raw = parseArray(value, path);
  if (!raw.ok) return undefined;
  const ratios: number[] = [];
  for (let index = 0; index < raw.value.length; index += 1) {
    const result = parseFiniteNumber(raw.value[index], `${path}[${index}]`, {
      min: 1,
      max: 100,
    });
    if (!result.ok) return undefined;
    ratios.push(result.value);
  }
  return ratios;
}

export function parseColumnsProps(
  value: unknown,
  path: string,
): ParseResult<ColumnsProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected columns props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();

  const ratios = parseColumnWidthRatios(
    value.columnWidthRatios,
    `${path}.columnWidthRatios`,
  );
  let columnWidthRatios: number[];
  if (ratios === undefined) {
    collector.push(
      issue(
        "value/invalid-column-widths",
        `"${path}.columnWidthRatios" must be an array of numbers between 1 and 100.`,
        { path: `${path}.columnWidthRatios` },
      ),
    );
    columnWidthRatios = [100];
  } else if (ratios.length < 1 || ratios.length > 4) {
    collector.push(
      issue(
        "value/invalid-column-count",
        `"${path}.columnWidthRatios" must declare 1 to 4 columns.`,
        {
          path: `${path}.columnWidthRatios`,
        },
      ),
    );
    columnWidthRatios = ratios;
  } else if (
    Math.round(ratios.reduce((total, ratio) => total + ratio, 0)) !== 100
  ) {
    collector.push(
      issue(
        "value/column-widths-not-normalized",
        `"${path}.columnWidthRatios" must sum to 100.`,
        {
          path: `${path}.columnWidthRatios`,
        },
      ),
    );
    columnWidthRatios = ratios;
  } else {
    columnWidthRatios = ratios;
  }

  const responsiveStack = collector.field(
    parseResponsiveStackBehavior(
      value.responsiveStack,
      `${path}.responsiveStack`,
    ),
    "stack",
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
    columnWidthRatios,
    responsiveStack,
    spacing,
    margin,
  });
}
