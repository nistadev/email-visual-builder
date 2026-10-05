import type { VisualDocument, VisualDocumentMode } from "../types/index.js";
import { migrateRawDocument, migrateRawNodes } from "./document-migrations.js";
import { parseNodeMap } from "./parse/node-map.js";
import { parseString } from "./primitives.js";
import { preflightVisualDocument } from "./preflight.js";
import { DEFAULT_BUILDER_REGISTRIES } from "./registry/default-registries.js";
import type { BuilderRegistries } from "./registry/types.js";
import { err, issue, ok, type ParseResult } from "./result.js";
import { buildTreeIndex } from "./tree.js";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./versions.js";

/**
 * The full parse-migrate-validate pipeline for a single canonical document:
 * preflight -> sequential document/block migrations -> settings + node
 * parsing (both dispatched through `registries`) -> tree-invariant
 * validation. See design.md decisions #2, #4, and #16.
 */
export function parseVisualDocument(
  input: unknown,
  registries: BuilderRegistries = DEFAULT_BUILDER_REGISTRIES,
): ParseResult<VisualDocument> {
  const preflightResult = preflightVisualDocument(input);
  if (!preflightResult.ok) return preflightResult;

  const migratedDocumentResult = migrateRawDocument(preflightResult.value.raw);
  if (!migratedDocumentResult.ok) return migratedDocumentResult;
  const migratedDocument = migratedDocumentResult.value;

  const migratedNodesResult = migrateRawNodes(
    migratedDocument.nodes as Record<string, unknown>,
    registries.blocks,
  );
  if (!migratedNodesResult.ok) return migratedNodesResult;

  const mode = migratedDocument.mode as VisualDocumentMode;
  const modeDefinition = registries.modes.get(mode);
  if (!modeDefinition) {
    return err([
      issue(
        "document/unregistered-mode",
        `Mode "${mode}" is not present in the mode registry.`,
      ),
    ]);
  }

  const rootIdResult = parseString(migratedDocument.rootId, "rootId", {
    allowEmpty: false,
    maxLength: 200,
  });
  const settingsResult = modeDefinition.parseSettings(
    migratedDocument.settings,
    "settings",
  );
  const nodesResult = parseNodeMap(
    migratedNodesResult.value,
    "nodes",
    registries.blocks,
  );

  const issues = [];
  if (!rootIdResult.ok) issues.push(...rootIdResult.issues);
  if (!settingsResult.ok) issues.push(...settingsResult.issues);
  if (!nodesResult.ok) issues.push(...nodesResult.issues);
  if (issues.length > 0) return err(issues);
  if (!rootIdResult.ok || !settingsResult.ok || !nodesResult.ok) {
    // Unreachable — satisfies narrowing below.
    return err([
      issue("document/internal-parse-error", "Unexpected parse state."),
    ]);
  }

  const treeResult = buildTreeIndex(rootIdResult.value, nodesResult.value);
  if (!treeResult.ok) return treeResult;

  if (mode === "email") {
    return ok({
      kind: "donativus.visual-document",
      schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
      mode: "email",
      rootId: rootIdResult.value,
      nodes: nodesResult.value,
      settings: settingsResult.value as Extract<
        VisualDocument,
        { mode: "email" }
      >["settings"],
    });
  }
  return ok({
    kind: "donativus.visual-document",
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    mode: "landing-page",
    rootId: rootIdResult.value,
    nodes: nodesResult.value,
    settings: settingsResult.value as Extract<
      VisualDocument,
      { mode: "landing-page" }
    >["settings"],
  });
}
