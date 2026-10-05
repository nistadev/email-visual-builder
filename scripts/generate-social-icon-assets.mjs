#!/usr/bin/env node
// Dev-only regeneration for the `social` block's bundled icon assets
// (design.md decision "Icon source"). Rasterizes each vendored SVG in
// assets/social-icons/svg/ three times — brand-color glyph, solid white
// glyph, solid black glyph — via @resvg/resvg-js, then writes a committed
// TS module of base64 PNG data URIs so the package build/runtime never
// needs SVG tooling. Run manually after adding/updating an icon:
// `node scripts/generate-social-icon-assets.mjs`.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SVG_DIR = join(ROOT, "assets/social-icons/svg");
const OUTPUT_PATH = join(
  ROOT,
  "src/core/blocks/social-icon-assets.generated.ts",
);
const OUTPUT_PX = 64;

/** Official brand color per platform; the generic glyphs use a neutral gray. */
const BRAND_COLORS = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  x: "#000000",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#000000",
  pinterest: "#E60023",
  whatsapp: "#25D366",
  website: "#4B5563",
  email: "#4B5563",
};

function recolorSvg(svgSource, hexColor) {
  // simple-icons paths carry no explicit fill (they inherit currentColor);
  // the hand-authored glyphs are the same shape. Wrapping in a `fill`
  // attribute on <svg> covers both without per-icon path edits.
  return svgSource.replace("<svg ", `<svg fill="${hexColor}" `);
}

function rasterizeToDataUri(svgSource, hexColor) {
  const colored = recolorSvg(svgSource, hexColor);
  const resvg = new Resvg(colored, {
    fitTo: { mode: "width", value: OUTPUT_PX },
  });
  const png = resvg.render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function main() {
  const files = readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg"));
  const platforms = files.map((f) => f.replace(/\.svg$/, "")).sort();

  const entries = platforms.map((platform) => {
    const svgSource = readFileSync(join(SVG_DIR, `${platform}.svg`), "utf8");
    const brandColor = BRAND_COLORS[platform];
    if (!brandColor) {
      throw new Error(`No brand color configured for platform "${platform}"`);
    }
    const brand = rasterizeToDataUri(svgSource, brandColor);
    const light = rasterizeToDataUri(svgSource, "#ffffff");
    const dark = rasterizeToDataUri(svgSource, "#111111");
    return { platform, brand, light, dark };
  });

  const platformUnion = platforms.map((p) => JSON.stringify(p)).join(" | ");
  const brandColorEntries = platforms
    .map((p) => `  ${JSON.stringify(p)}: ${JSON.stringify(BRAND_COLORS[p])},`)
    .join("\n");
  const iconEntries = entries
    .map(
      (e) =>
        `  ${JSON.stringify(e.platform)}: {\n` +
        `    brand: ${JSON.stringify(e.brand)},\n` +
        `    light: ${JSON.stringify(e.light)},\n` +
        `    dark: ${JSON.stringify(e.dark)},\n` +
        `  },`,
    )
    .join("\n");

  const output = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-social-icon-assets.mjs
// Source SVGs: assets/social-icons/svg/ (see design.md for provenance —
// simple-icons CC0 brand marks + two hand-authored generic glyphs).

export const SOCIAL_PLATFORMS = [
${platforms.map((p) => `  ${JSON.stringify(p)},`).join("\n")}
] as const;

export type SocialIconPlatform = ${platformUnion};

/** Official brand hex color per platform (used by the \`logo\` icon style, and as the default \`filled\` background). */
export const SOCIAL_ICON_BRAND_COLORS: Record<SocialIconPlatform, string> = {
${brandColorEntries}
};

/**
 * Baked ${OUTPUT_PX}x${OUTPUT_PX} PNG data URIs per platform: \`brand\` is the
 * full-color mark on a transparent background (icon style \`logo\`);
 * \`light\`/\`dark\` are solid white/near-black glyphs on a transparent
 * background — \`light\` sits over a colored shape (\`filled\`/\`filled-color\`),
 * \`dark\` sits directly on the page (\`no-color\`) or over a pale custom color.
 */
export const SOCIAL_ICON_DATA_URIS: Record<
  SocialIconPlatform,
  { brand: string; light: string; dark: string }
> = {
${iconEntries}
};
`;

  writeFileSync(OUTPUT_PATH, output);
  console.log(
    `Wrote ${platforms.length} icons (${platforms.join(", ")}) to ${OUTPUT_PATH}`,
  );
}

main();
