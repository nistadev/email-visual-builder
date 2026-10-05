import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const srcDir = dirname(fileURLToPath(import.meta.url));

const NODE_SAFE_ENTRYPOINTS = ["core", "renderers"] as const;

const FORBIDDEN_IMPORT_PATTERN =
  /from\s+["'](react|react-dom|react\/jsx-runtime|@lexical\/react|@dnd-kit\/[^"']+)["']/;
/**
 * `window`/`navigator`/`localStorage` have no legitimate meaning as local
 * identifiers in this domain, so any bare reference is suspicious. `document`
 * is different — `VisualDocument` values are routinely named/parametered
 * `document` throughout core (e.g. `document.nodes`), so only genuinely
 * DOM-specific members of it are flagged.
 */
const FORBIDDEN_GLOBAL_PATTERN =
  /\b(window|navigator|localStorage)\s*[.[]|\bdocument\.(createElement|getElementById|querySelector|querySelectorAll|addEventListener|removeEventListener|cookie|documentElement|activeElement|body|head)\b/;
/** Matches single/double/backtick-quoted string contents (no escape handling needed — source has none spanning these). */
const STRING_LITERAL_PATTERN =
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/** Strips string literals so import-path substrings like `"./parse-document.js"` can't false-positive against `FORBIDDEN_GLOBAL_PATTERN`. */
function withoutStringLiterals(contents: string): string {
  return contents.replace(STRING_LITERAL_PATTERN, '""');
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

test.describe("core/renderers package boundary", () => {
  for (const entrypoint of NODE_SAFE_ENTRYPOINTS) {
    test(`${entrypoint} source contains no React or browser-global references`, () => {
      const dir = join(srcDir, entrypoint);
      const files = collectSourceFiles(dir);
      assert.ok(
        files.length > 0,
        `expected source files under src/${entrypoint}`,
      );

      for (const file of files) {
        const contents = readFileSync(file, "utf8");
        assert.doesNotMatch(
          contents,
          FORBIDDEN_IMPORT_PATTERN,
          `${file} must not import a React/DOM-dependent package`,
        );
        assert.doesNotMatch(
          withoutStringLiterals(contents),
          FORBIDDEN_GLOBAL_PATTERN,
          `${file} must not reference browser globals directly`,
        );
      }
    });

    test(`${entrypoint} entrypoint executes in Node without defining browser globals`, async () => {
      const hadWindow = "window" in globalThis;
      const hadDocument = "document" in globalThis;

      await import(`./${entrypoint}/index.js`);

      assert.equal("window" in globalThis, hadWindow);
      assert.equal("document" in globalThis, hadDocument);
    });
  }
});
