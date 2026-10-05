// The standalone landing-page HTML5 shell (design.md decision #12, task
// 10.1). No embedded forms, scripts, iframes, or arbitrary HTML/CSS — the
// document schema itself excludes those (design.md decision #6), so nothing
// here needs to filter them out.

import type { LandingPageVisualDocument } from "../../types/index.js";
import type { BuilderRegistries } from "../../core/registry/types.js";
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  serializeInlineStyle,
} from "../escape.js";
import { spacingStyleEntries, typographyStyleEntries } from "../style.js";
import { createRendererContext } from "../traversal.js";
import { renderLandingNode } from "./render-node.js";

const RESET_STYLES =
  "*{box-sizing:border-box;}body{margin:0;}img{max-width:100%;height:auto;}";

export function renderLandingDocument(
  document: LandingPageVisualDocument,
  registries: BuilderRegistries,
): string {
  const context = createRendererContext(document, registries);
  const {
    language,
    title,
    metaDescription,
    pageBackgroundColor,
    contentWidth,
    contentAlign,
    spacing,
    defaultTypography,
    textColor,
    faviconUrl,
  } = document.settings;

  const bodyStyle = serializeInlineStyle([
    ["margin", "0"],
    ["background-color", pageBackgroundColor],
    ...typographyStyleEntries(defaultTypography).filter(
      ([property]) => property !== "color",
    ),
    ["color", textColor],
  ]);

  const rootNode = document.nodes[document.rootId];
  const rootChildrenHtml = (
    rootNode && !("unavailable" in rootNode) ? (rootNode.children ?? []) : []
  )
    .map((childId) => renderLandingNode(childId, document, context))
    .join("");

  const mainStyle = serializeInlineStyle([
    [
      "width",
      contentWidth.unit === "percent" ? `${contentWidth.value}%` : "100%",
    ],
    [
      "max-width",
      contentWidth.unit === "px" ? `${contentWidth.value}px` : null,
    ],
    [
      "margin-left",
      contentAlign === "right" || contentAlign === "center" ? "auto" : "0",
    ],
    [
      "margin-right",
      contentAlign === "left" || contentAlign === "center" ? "auto" : "0",
    ],
    ...spacingStyleEntries(spacing),
  ]);

  const descriptionTag =
    metaDescription !== null
      ? `<meta name="description" content="${escapeHtmlAttribute(metaDescription)}">`
      : "";
  const faviconTag =
    faviconUrl !== null
      ? `<link rel="icon" href="${escapeHtmlAttribute(faviconUrl)}">`
      : "";
  const styleBlock = `<style>${RESET_STYLES}${context.collectMediaCss()}</style>`;

  return (
    "<!doctype html>" +
    `<html lang="${escapeHtmlAttribute(language)}">` +
    "<head>" +
    '<meta charset="utf-8">' +
    `<title>${escapeHtmlText(title)}</title>` +
    descriptionTag +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    faviconTag +
    styleBlock +
    "</head>" +
    `<body style="${bodyStyle}">` +
    `<main style="${mainStyle}">${rootChildrenHtml}</main>` +
    "</body></html>"
  );
}
