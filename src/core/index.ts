/**
 * `email-visual-builder/core` — parsing, migrations, registries,
 * commands, controller/store, validation, and serialization.
 *
 * This entrypoint MUST remain free of React and browser-global imports so it
 * can execute in Node (API, worker, future server consumers).
 */

export type * from "../types/index.js";
export { parseVisualDocument } from "./parse-document.js";
export { serializeVisualDocument } from "./serialize.js";
export { buildTreeIndex, type VisualDocumentTreeIndex } from "./tree.js";
export { runMigrationChain, type MigrationStep } from "./migrations.js";
export { collectUnavailableNodeIssues } from "./unavailable-nodes.js";
export { validateBlockConstraints } from "./validate-block-constraints.js";
export { createStarterDocument } from "./starter-document.js";
export {
  FONT_CATALOGUE,
  FONT_GROUPS,
  isCatalogueFont,
  type FontGroup,
  type FontOption,
} from "./fonts.js";
export {
  importUnlayerEmailDesign,
  type UnlayerEmailImportFailure,
  type UnlayerEmailImportResult,
  type UnlayerEmailImportSuccess,
} from "./unlayer-import.js";
export {
  BuilderController,
  commandFailure,
  commandSuccess,
  coalesceKeyFor,
  createDefaultTransientState,
  createIdGenerator,
  selectDocument,
  selectNode,
  selectSelectedNode,
  selectSelectedNodeId,
  selectTransient,
  subscribeWithSelector,
  type BuilderCommand,
  type BuilderControllerOptions,
  type BuilderState,
  type CommandFailure,
  type CommandResult,
  type CommandSuccess,
  type DuplicateNodeCommand,
  type EditorTransientState,
  type IdGenerator,
  type InsertNodeCommand,
  type MoveNodeCommand,
  type RemoveNodeCommand,
  type UpdateDocumentSettingsCommand,
  type UpdateNodePropsCommand,
  type UpdateRichTextCommand,
} from "./controller/index.js";
export {
  buildRegistry,
  createBlockRegistry,
  createBuilderRegistries,
  createInspectorControlRegistry,
  createModeRegistry,
  createVariableRegistry,
  listBlockTypesForMode,
  DEFAULT_BUILDER_REGISTRIES,
  type BlockDefinition,
  type BlockRegistry,
  type BuilderRegistries,
  type BuildRegistryOptions,
  type InspectorControlDefinition,
  type InspectorControlRegistry,
  type ModeDefinition,
  type ModeRegistry,
  type Registry,
  type VariableRegistry,
  type VariableRegistryDefinition,
} from "./registry/index.js";
export { VISUAL_DOCUMENT_LIMITS, HEX_COLOR_PATTERN } from "./limits.js";
export {
  CURRENT_DOCUMENT_SCHEMA_VERSION,
  CURRENT_BLOCK_VERSIONS,
  isBuiltInBlockType,
  type BuiltInBlockType,
} from "./versions.js";
export {
  ok,
  err,
  issue,
  FieldCollector,
  type ParseResult,
  type ParseSuccess,
  type ParseFailure,
  type IssueLocation,
} from "./result.js";
export { validateSafeUrl, type UrlValidationOptions } from "./url.js";
export {
  DEFAULT_VARIABLE_SYNTAX,
  findVariableLikeMatches,
  type VariableSyntaxDefinition,
} from "./variables/token-syntax.js";
export {
  resolveVariableReference,
  type VariableResolution,
} from "./variables/resolve.js";
export { checkLiteralTextForUnresolvedVariables } from "./variables/unresolved-text.js";
export { validateTemplatedValue } from "./variables/validate-templated-value.js";
export { validateRichTextValue } from "./variables/validate-rich-text.js";
export { validateDocumentVariablesAndUrls } from "./variables/validate-document.js";
export {
  collectLinkQualityWarnings,
  collectUnsubscribeLinkWarning,
} from "./variables/document-quality-checks.js";
