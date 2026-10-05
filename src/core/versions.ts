/**
 * Current schema versions for the document and each built-in block. There
 * are no historical versions yet (this is the v1 release) — the migration
 * framework in `migrations.ts` exists so future versions can be added
 * without a breaking parser rewrite.
 */

export const CURRENT_DOCUMENT_SCHEMA_VERSION = 1;

export const CURRENT_BLOCK_VERSIONS = {
  "document-root": 1,
  section: 1,
  columns: 1,
  column: 1,
  heading: 1,
  "rich-text": 1,
  image: 1,
  cta: 1,
  divider: 1,
  spacer: 1,
  social: 1,
} as const;

export type BuiltInBlockType = keyof typeof CURRENT_BLOCK_VERSIONS;

export function isBuiltInBlockType(type: string): type is BuiltInBlockType {
  return Object.prototype.hasOwnProperty.call(CURRENT_BLOCK_VERSIONS, type);
}
