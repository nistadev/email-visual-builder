import type { VisualBuilderImageAsset } from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseFiniteNumber,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";

export function parseImageAsset(
  value: unknown,
  path: string,
): ParseResult<VisualBuilderImageAsset | null> {
  if (value === null) return { ok: true, value: null };
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected an image asset object at "${path}".`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const url = collector.field(
    parseString(value.url, `${path}.url`, {
      allowEmpty: false,
      maxLength: 2000,
    }),
    "",
  );
  const filename = collector.field(
    parseString(value.filename, `${path}.filename`, {
      allowEmpty: false,
      maxLength: 500,
    }),
    "",
  );
  const mimeType = collector.field(
    parseString(value.mimeType, `${path}.mimeType`, {
      allowEmpty: false,
      maxLength: 200,
    }),
    "",
  );

  const asset: VisualBuilderImageAsset = { url, filename, mimeType };

  if (value.widthPx !== undefined) {
    const widthPx = collector.field(
      parseFiniteNumber(value.widthPx, `${path}.widthPx`, {
        min: 0,
        max: VISUAL_DOCUMENT_LIMITS.maxDimensionPx,
      }),
      0,
    );
    asset.widthPx = widthPx;
  }
  if (value.heightPx !== undefined) {
    const heightPx = collector.field(
      parseFiniteNumber(value.heightPx, `${path}.heightPx`, {
        min: 0,
        max: VISUAL_DOCUMENT_LIMITS.maxDimensionPx,
      }),
      0,
    );
    asset.heightPx = heightPx;
  }

  return collector.finish(asset);
}
