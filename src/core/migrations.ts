import { err, issue, ok, type ParseResult } from "./result.js";

export interface MigrationStep<T> {
  fromVersion: number;
  toVersion: number;
  migrate: (value: T) => T;
}

/**
 * Runs a value through a sequential, explicit chain of migration steps from
 * its declared version up to `targetVersion`. Used for both document-level
 * and per-block migrations (design.md decision #2/#4) — a version newer
 * than `targetVersion` is rejected outright, and a version with no
 * registered next step fails deterministically rather than silently
 * skipping ahead.
 */
export function runMigrationChain<T>(
  value: T,
  currentVersion: number,
  targetVersion: number,
  steps: readonly MigrationStep<T>[],
  describe: (version: number) => string,
): ParseResult<{ value: T; version: number }> {
  if (currentVersion > targetVersion) {
    return err([
      issue(
        "document/future-schema-version",
        `${describe(currentVersion)} is newer than the supported version ${targetVersion}.`,
      ),
    ]);
  }

  let version = currentVersion;
  let result = value;
  while (version < targetVersion) {
    const step = steps.find((candidate) => candidate.fromVersion === version);
    if (!step) {
      return err([
        issue(
          "document/missing-migration-step",
          `No migration is registered from ${describe(version)} toward version ${targetVersion}.`,
        ),
      ]);
    }
    result = step.migrate(result);
    version = step.toVersion;
  }

  return ok({ value: result, version });
}
