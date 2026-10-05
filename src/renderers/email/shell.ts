// The standalone email doctype/head/body shell (design.md decision #11,
// task 9.1). Resets are the small, widely-used Litmus/Email-on-Acid set —
// no external stylesheet, script, or client-specific conditional HTML beyond
// these inert `mso-*` properties, which non-Outlook clients simply ignore.
//
// Task 9.7 — supported compatibility subset and intentional exclusions:
// - Layout is exclusively nested `role="presentation"` tables with explicit
//   `width`/`cellpadding`/`cellspacing`/`border` attributes and inline
//   styles; there is no CSS grid, flexbox, or external stylesheet, so
//   layout survives clients that strip `<style>` (e.g. older webmail).
// - Responsive column stacking is a single `@media (max-width:480px)` rule
//   toggling `display:block!important;width:100%!important` on generated
//   classes — clients that ignore `<style>`/media queries (some webmail,
//   very old Outlook) render the fixed desktop table layout instead of
//   stacking; this is an intentional degrade, not a rendering bug.
//   Outlook desktop (Word engine) additionally ignores `max-width` on
//   images/tables — dimensions are always also set via HTML attributes for
//   that reason, not CSS alone.
// - No script, iframe, form, embedded image, web font `@font-face`,
//   or CSS animation is ever emitted — these are excluded by the document
//   schema itself (design.md decision #6/#16), not filtered here.
// - `letter-spacing` and `border-radius` (used by `cta`) are unsupported in
//   Outlook desktop; the button still renders as a plain rectangular link.

import type { EmailVisualDocument } from "../../types/index.js";
import type { BuilderRegistries } from "../../core/registry/types.js";
import type { ModeRendererOptions } from "../render-types.js";
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  serializeInlineStyle,
} from "../escape.js";
import { spacingStyleEntries, typographyStyleEntries } from "../style.js";
import { createRendererContext } from "../traversal.js";
import { renderEmailNode } from "./render-node.js";

const RESET_STYLES =
  "body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}" +
  "table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}" +
  "img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}" +
  "body{margin:0;padding:0;width:100% !important;height:100% !important;}";

export function renderEmailDocument(
  document: EmailVisualDocument,
  registries: BuilderRegistries,
  options: ModeRendererOptions = {},
): string {
  const context = createRendererContext(document, registries, options);
  const {
    language,
    previewText,
    canvasBackgroundColor,
    contentWidth,
    contentAlign,
    spacing,
    defaultTypography,
    textColor,
  } = document.settings;

  const bodyStyle = serializeInlineStyle([
    ["margin", "0"],
    ["padding", "0"],
    ["background-color", canvasBackgroundColor],
    ...typographyStyleEntries(defaultTypography).filter(
      ([property]) => property !== "color",
    ),
    ["color", textColor],
  ]);
  const outerTableStyle = serializeInlineStyle([
    ["background-color", canvasBackgroundColor],
  ]);
  const contentWidthAttr =
    contentWidth.unit === "px"
      ? String(contentWidth.value)
      : `${contentWidth.value}%`;
  // Keep the pixel width attribute for Outlook, but let modern/mobile clients
  // shrink the table to the viewport instead of producing horizontal scroll.
  const contentTableStyle = serializeInlineStyle([
    ["width", contentWidth.unit === "px" ? "100%" : null],
    [
      "max-width",
      contentWidth.unit === "px" ? `${contentWidth.value}px` : null,
    ],
  ]);
  const contentCellStyle = serializeInlineStyle(spacingStyleEntries(spacing));

  const rootNode = document.nodes[document.rootId];
  const rootChildrenHtml = (
    rootNode && !("unavailable" in rootNode) ? (rootNode.children ?? []) : []
  )
    .map((childId) => renderEmailNode(childId, document, context))
    .join("");

  const preview =
    previewText.trim().length > 0
      ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtmlText(previewText)}</div>`
      : "";

  const styleBlock = `<style type="text/css">${RESET_STYLES}${context.collectMediaCss()}</style>`;

  return (
    "<!doctype html>" +
    `<html lang="${escapeHtmlAttribute(language)}">` +
    "<head>" +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">' +
    styleBlock +
    "</head>" +
    `<body style="${bodyStyle}">` +
    preview +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${outerTableStyle}"><tr><td align="${contentAlign}">` +
    `<table role="presentation" width="${contentWidthAttr}" cellpadding="0" cellspacing="0" border="0" align="${contentAlign}"${contentTableStyle ? ` style="${contentTableStyle}"` : ""}>` +
    `<tr><td style="${contentCellStyle}">${rootChildrenHtml}</td></tr></table>` +
    "</td></tr></table>" +
    "</body></html>"
  );
}
