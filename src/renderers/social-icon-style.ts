// Shared per-item presentation math for the `social` block, used by both
// the email and landing renderers (design.md decision "One raster asset
// pipeline"). Keeps icon-vs-wrapper sizing, background, and shape identical
// across modes so the two renderers only differ in HTML structure
// (table cells vs a flex row).

import type {
  HexColor,
  SocialGlyphTone,
  SocialIconShape,
  SocialIconStyle,
} from "../types/index.js";
import {
  SOCIAL_ICON_BRAND_COLORS,
  SOCIAL_ICON_DATA_URIS,
  type SocialIconPlatform,
} from "../core/blocks/social-icon-assets.generated.js";

/** The glyph inset inside the shape for a filled style, proportional to icon size — the shape (`wrapperSizePx`) always equals `iconSizePx` so switching style never changes the icon's visual footprint, only what's drawn inside it. */
const FILLED_PADDING_RATIO = 0.2;

export interface SocialItemStyle {
  imgSrc: string;
  imgSizePx: number;
  wrapperSizePx: number;
  paddingPx: number;
  backgroundColor: string | null;
  borderRadiusCss: string;
}

function borderRadiusCss(
  shape: SocialIconShape,
  wrapperSizePx: number,
): string {
  if (shape === "circle") return "50%";
  if (shape === "square") return "0";
  return `${Math.round(wrapperSizePx * 0.25)}px`;
}

function filledStyle(
  glyphSrc: string,
  backgroundColor: string,
  shape: SocialIconShape,
  iconSizePx: number,
): SocialItemStyle {
  const paddingPx = Math.round(iconSizePx * FILLED_PADDING_RATIO);
  return {
    imgSrc: glyphSrc,
    imgSizePx: iconSizePx - paddingPx * 2,
    wrapperSizePx: iconSizePx,
    paddingPx,
    backgroundColor,
    borderRadiusCss: borderRadiusCss(shape, iconSizePx),
  };
}

/**
 * Resolves one item's icon/wrapper presentation for the current
 * `iconStyle`:
 * - `logo` — full brand-color glyph, no background.
 * - `filled` — a `light` (white) glyph over that platform's own brand
 *   color, unchanged from the original default look.
 * - `filled-color` — a glyph in the requested `glyphTone` over the shared
 *   `color`.
 * - `no-color` — the glyph in the requested `glyphTone` alone, no shape.
 */
export function resolveSocialItemStyle(
  platform: SocialIconPlatform,
  iconStyle: SocialIconStyle,
  shape: SocialIconShape,
  iconSizePx: number,
  color: HexColor,
  glyphTone: SocialGlyphTone,
  emailAssetBaseUrl?: string,
): SocialItemStyle {
  const assets = SOCIAL_ICON_DATA_URIS[platform];
  const assetUrl = (variant: "brand" | "light" | "dark") =>
    emailAssetBaseUrl
      ? `${emailAssetBaseUrl.replace(/\/$/, "")}/public/email-assets/social/${platform}/${variant}.png`
      : assets[variant];

  if (iconStyle === "logo") {
    return {
      imgSrc: assetUrl("brand"),
      imgSizePx: iconSizePx,
      wrapperSizePx: iconSizePx,
      paddingPx: 0,
      backgroundColor: null,
      borderRadiusCss: "0",
    };
  }
  if (iconStyle === "filled") {
    return filledStyle(
      assetUrl("light"),
      SOCIAL_ICON_BRAND_COLORS[platform],
      shape,
      iconSizePx,
    );
  }
  if (iconStyle === "filled-color") {
    return filledStyle(assetUrl(glyphTone), color, shape, iconSizePx);
  }
  // no-color
  return {
    imgSrc: assetUrl(glyphTone),
    imgSizePx: iconSizePx,
    wrapperSizePx: iconSizePx,
    paddingPx: 0,
    backgroundColor: null,
    borderRadiusCss: "0",
  };
}

export function socialItemAltText(platform: SocialIconPlatform): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
