import type { MigrationStep } from "./migrations.js";
import { runMigrationChain } from "./migrations.js";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./versions.js";
import { isPlainObject, parsePositiveInteger } from "./primitives.js";
import type { BlockRegistry } from "./registry/types.js";
import { err, ok, type ParseResult } from "./result.js";

type JsonRecord = Record<string, unknown>;

/**
 * Registered document-schema migrations, ordered by `fromVersion`. Empty
 * today — this is the v1 release — but the chain-walking engine in
 * `migrations.ts` is exercised by future versions without a parser rewrite.
 */
const DOCUMENT_MIGRATION_STEPS: readonly MigrationStep<JsonRecord>[] = [];

export function migrateRawDocument(raw: JsonRecord): ParseResult<JsonRecord> {
  const versionResult = parsePositiveInteger(
    raw.schemaVersion,
    "schemaVersion",
  );
  if (!versionResult.ok) return versionResult;

  const chainResult = runMigrationChain(
    raw,
    versionResult.value,
    CURRENT_DOCUMENT_SCHEMA_VERSION,
    DOCUMENT_MIGRATION_STEPS,
    (version) => `Document schema version ${version}`,
  );
  if (!chainResult.ok) return chainResult;

  return ok({
    ...chainResult.value.value,
    schemaVersion: chainResult.value.version,
  });
}

/**
 * Applies each registered block's own migration chain to every node's
 * `props` before structural parsing. Nodes whose type is absent from the
 * registry are left untouched here — they are preserved as "unavailable"
 * nodes by the node-map parser rather than migrated or discarded.
 */
export function migrateRawNodes(
  rawNodes: JsonRecord,
  blockRegistry: BlockRegistry,
): ParseResult<JsonRecord> {
  const migrated: JsonRecord = {};
  const issues = [];

  for (const [nodeId, rawNode] of Object.entries(rawNodes)) {
    if (!isPlainObject(rawNode)) {
      migrated[nodeId] = rawNode;
      continue;
    }
    const type = typeof rawNode.type === "string" ? rawNode.type : "";
    const definition = blockRegistry.get(type);
    if (!definition) {
      migrated[nodeId] = rawNode;
      continue;
    }

    const versionResult = parsePositiveInteger(
      rawNode.version,
      `nodes.${nodeId}.version`,
    );
    if (!versionResult.ok) {
      issues.push(...versionResult.issues);
      continue;
    }

    const steps = definition.migrations ?? [];
    const chainResult = runMigrationChain(
      isPlainObject(rawNode.props) ? rawNode.props : {},
      versionResult.value,
      definition.version,
      steps,
      (version) => `Node "${nodeId}" (type "${type}") version ${version}`,
    );
    if (!chainResult.ok) {
      issues.push(...chainResult.issues);
      continue;
    }

    migrated[nodeId] = {
      ...rawNode,
      version: chainResult.value.version,
      props: chainResult.value.value,
    };
  }

  if (issues.length > 0) return err(issues);
  return ok(migrated);
}
