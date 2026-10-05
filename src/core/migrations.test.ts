import assert from "node:assert/strict";
import test from "node:test";
import { runMigrationChain, type MigrationStep } from "./migrations.js";
import { parseVisualDocument } from "./parse-document.js";
import { createValidEmailDocumentInput } from "../test-utils/visual-document-fixture.js";

interface Doc {
  value: string;
}

const describeVersion = (version: number) => `Fixture version ${version}`;

test.describe("runMigrationChain", () => {
  test("walks a multi-step chain from an older supported version to current", () => {
    const steps: MigrationStep<Doc>[] = [
      {
        fromVersion: 1,
        toVersion: 2,
        migrate: (doc) => ({ value: `${doc.value}+v2` }),
      },
      {
        fromVersion: 2,
        toVersion: 3,
        migrate: (doc) => ({ value: `${doc.value}+v3` }),
      },
    ];
    const result = runMigrationChain(
      { value: "start" },
      1,
      3,
      steps,
      describeVersion,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.value.value, "start+v2+v3");
    assert.equal(result.value.version, 3);
  });

  test("is a no-op when the current version already matches the target", () => {
    const result = runMigrationChain(
      { value: "start" },
      3,
      3,
      [],
      describeVersion,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.value.value, "start");
  });

  test("fails deterministically when a migration step is missing", () => {
    const steps: MigrationStep<Doc>[] = [
      { fromVersion: 1, toVersion: 2, migrate: (doc) => doc },
    ];
    // No step registered from version 2 -> 3.
    const result = runMigrationChain(
      { value: "start" },
      1,
      3,
      steps,
      describeVersion,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/missing-migration-step",
      ),
    );
  });

  test("rejects a version newer than the target without rewriting it", () => {
    const result = runMigrationChain(
      { value: "from-the-future" },
      5,
      3,
      [],
      describeVersion,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/future-schema-version",
      ),
    );
  });
});

test.describe("parseVisualDocument — schema version boundaries", () => {
  test("rejects a document schema version newer than the installed package supports", () => {
    const input = createValidEmailDocumentInput();
    input.schemaVersion = 999;

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "document/future-schema-version",
      ),
    );
  });

  test("rejects a node block version newer than the installed package supports", () => {
    const input = createValidEmailDocumentInput();
    (input.nodes as Record<string, any>)["heading-1"].version = 999;

    const result = parseVisualDocument(input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.code === "document/future-schema-version" ||
          issue.code === "document/missing-migration-step",
      ),
    );
  });
});
