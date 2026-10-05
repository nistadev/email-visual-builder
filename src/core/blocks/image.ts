import type { ImageProps, WidthValue } from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseBoolean,
  parseFiniteNumber,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseSpacing,
  parseWidth,
} from "../parse/presentation.js";
import { parseTemplatedValue } from "../parse/templated-value.js";
import { parseImageAsset } from "../parse/asset.js";

export function parseImageProps(
  value: unknown,
  path: string,
): ParseResult<ImageProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected image props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const asset = collector.field(
    parseImageAsset(value.asset ?? null, `${path}.asset`),
    null,
  );
  const altText = collector.field(
    parseString(value.altText, `${path}.altText`, {
      allowEmpty: true,
      maxLength: VISUAL_DOCUMENT_LIMITS.maxStringLength,
    }),
    "",
  );
  const displayWidth = collector.field<WidthValue>(
    parseWidth(value.displayWidth, `${path}.displayWidth`),
    {
      unit: "percent",
      value: 100,
    },
  );
  const align = collector.field(
    parseHorizontalAlignment(value.align, `${path}.align`),
    "left",
  );

  let link: ImageProps["link"] = null;
  if (value.link !== null && value.link !== undefined) {
    const result = parseTemplatedValue(value.link, `${path}.link`);
    link = collector.field(result, null);
  }

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
    asset,
    altText,
    displayWidth,
    align,
    link,
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
