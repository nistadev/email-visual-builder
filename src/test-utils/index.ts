/**
 * Test-only utilities. Excluded from `tsconfig.json`'s build include and from
 * the package's public `exports` map — never resolvable by consumers, only
 * imported by this package's own `*.test.ts`/`*.test.tsx` files via relative
 * paths.
 */

export { installJsdomGlobals } from "./setup-jsdom.js";
export type { JsdomHandle } from "./setup-jsdom.js";

export {
  buildLargeVisualDocument,
  LARGE_DOCUMENT_SECTION_COUNT,
  LARGE_DOCUMENT_CONTENT_BLOCK_TYPES,
} from "./large-document-fixture.js";
export type { LargeDocumentFixture } from "./large-document-fixture.js";

export { pollUntil } from "./poll-until.js";
