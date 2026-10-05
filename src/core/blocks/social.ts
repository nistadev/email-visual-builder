import type { SocialLinkItem, SocialProps } from "../../types/index.js";
import { SOCIAL_PLATFORMS } from "./social-icon-assets.generated.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseArray,
  parseEnum,
  parseFiniteNumber,
  parseHexColor,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseOptionalSpacing,
  parseSpacing,
} from "../parse/presentation.js";

const ICON_STYLES = ["logo", "filled", "filled-color", "no-color"] as const;
const ICON_SHAPES = ["circle", "square", "rounded"] as const;
const GLYPH_TONES = ["light", "dark"] as const;
const MIN_ICON_SIZE_PX = 12;
const MAX_ICON_SIZE_PX = 96;

function parseSocialItem(
  value: unknown,
  path: string,
): ParseResult<SocialLinkItem> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a social item at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const id = collector.field(
    parseString(value.id, `${path}.id`, { allowEmpty: false, maxLength: 200 }),
    path,
  );
  const platform = collector.field(
    parseEnum(value.platform, SOCIAL_PLATFORMS, `${path}.platform`),
    "website",
  );
  const url = collector.field(
    parseString(value.url, `${path}.url`, {
      allowEmpty: true,
      maxLength: VISUAL_DOCUMENT_LIMITS.maxStringLength,
    }),
    "",
  );
  return collector.finish({ id, platform, url });
}

function parseSocialItems(
  value: unknown,
  path: string,
): ParseResult<SocialLinkItem[]> {
  const raw = parseArray(value, path);
  if (!raw.ok) return raw;
  if (raw.value.length > VISUAL_DOCUMENT_LIMITS.maxSocialItems) {
    return err([
      issue(
        "value/too-many-items",
        `"${path}" must declare at most ${VISUAL_DOCUMENT_LIMITS.maxSocialItems} items.`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const items = raw.value.map((item, index) =>
    collector.field(parseSocialItem(item, `${path}[${index}]`), {
      id: `item-${index}`,
      platform: "website" as const,
      url: "",
    }),
  );
  return collector.finish(items);
}

export function parseSocialProps(
  value: unknown,
  path: string,
): ParseResult<SocialProps> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected social props at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const items = collector.field(parseSocialItems(value.items, `${path}.items`), []);
  const iconStyle = collector.field(
    parseEnum(value.iconStyle, ICON_STYLES, `${path}.iconStyle`),
    "logo",
  );
  const shape = collector.field(
    parseEnum(value.shape, ICON_SHAPES, `${path}.shape`),
    "circle",
  );
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#000000",
  );
  const glyphTone = collector.field(
    parseEnum(value.glyphTone, GLYPH_TONES, `${path}.glyphTone`),
    "light",
  );
  const iconSizePx = collector.field(
    parseFiniteNumber(value.iconSizePx, `${path}.iconSizePx`, {
      min: MIN_ICON_SIZE_PX,
      max: MAX_ICON_SIZE_PX,
    }),
    32,
  );
  const gapPx = collector.field(
    parseFiniteNumber(value.gapPx, `${path}.gapPx`, {
      min: 0,
      max: VISUAL_DOCUMENT_LIMITS.maxSpacingPx,
    }),
    8,
  );
  const align = collector.field(
    parseHorizontalAlignment(value.align, `${path}.align`),
    "left",
  );
  const spacing = collector.field(
    parseSpacing(value.spacing, `${path}.spacing`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  const margin = collector.field(
    parseOptionalSpacing(value.margin, `${path}.margin`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  return collector.finish({
    items,
    iconStyle,
    shape,
    color,
    glyphTone,
    iconSizePx,
    gapPx,
    align,
    spacing,
    margin,
  });
}
