/**
 * `email-visual-builder/renderers` — pure email and landing-page HTML
 * exporters.
 *
 * This entrypoint MUST remain free of React and browser-global imports so it
 * can execute in Node (API, worker, future server consumers).
 */

export {
  escapeHtmlText,
  escapeHtmlAttribute,
  escapeCssValue,
  serializeInlineStyle,
  type StyleEntry,
} from "./escape.js";
export {
  typographyStyleEntries,
  spacingStyleEntries,
  backgroundStyleEntries,
  borderStyleEntries,
  widthStyleEntries,
} from "./style.js";
export {
  traverseDocument,
  RendererContext,
  createRendererContext,
  type VisitedNode,
} from "./traversal.js";
export {
  isModeRenderer,
  type ModeRenderer,
  type ModeRendererOptions,
  isBlockRenderer,
  type BlockRenderer,
} from "./render-types.js";
export { renderTemplatedValueAsText } from "./templated-text.js";
export {
  exportVisualDocument,
  type VisualDocumentExportOptions,
} from "./pipeline.js";
export { DEFAULT_RENDERER_REGISTRIES } from "./registries.js";
export { renderEmailDocument } from "./email/index.js";
export { renderLandingDocument } from "./landing/index.js";
export {
  SOCIAL_ICON_DATA_URIS,
  SOCIAL_PLATFORMS,
  type SocialIconPlatform,
} from "../core/blocks/social-icon-assets.generated.js";
