/**
 * Documented resource limits enforced before/during recursive parsing and
 * rendering (design.md decision #16). Values are deliberately generous
 * ceilings against adversarial/malformed input, not authoring UX limits.
 */
export const VISUAL_DOCUMENT_LIMITS = {
  /** Raw JSON input size, checked during preflight before any deep walk. */
  maxInputBytes: 2_000_000,
  /** Total nodes in a document's normalized `nodes` record. */
  maxNodeCount: 2_000,
  /** Max nesting depth of a node's `props` value, and of the node tree itself. */
  maxDepth: 24,
  /** Max children on any single container node (structural safety net, not a per-block authoring rule). */
  maxChildrenPerNode: 200,
  /** Generic ceiling for short text fields (labels, alt text, URLs, ...). */
  maxStringLength: 10_000,
  /** Ceiling for a single rich-text value once serialized. */
  maxRichTextBytes: 200_000,
  minDimensionPx: 0,
  maxDimensionPx: 4_000,
  maxSpacingPx: 200,
  /** Absolute ceiling for shadow offsets, blur, and spread. */
  maxShadowPx: 200,
  maxBorderRadiusPx: 200,
  /** Max items on a single `social` block. */
  maxSocialItems: 12,
  /**
   * Matches the API's existing template HTML ceiling
   * (`apps/api/.../template-html.util.ts`), which remains authoritative.
   */
  maxHtmlBytes: 500 * 1024,
  maxCanonicalJsonBytes: 2_000_000,
} as const;

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
