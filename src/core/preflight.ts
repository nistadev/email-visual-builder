import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { isPlainObject } from "./primitives.js";
import { err, issue, ok, type ParseResult } from "./result.js";

export interface PreflightedDocument {
  raw: Record<string, unknown>;
  nodes: Record<string, unknown>;
}

/**
 * Cheap shape/size checks that run before any recursive parsing (design.md
 * decision #16). Rejects malformed, oversized, or over-complex input early
 * so a hostile payload never reaches the deep parser.
 */
export function preflightVisualDocument(
  input: unknown,
): ParseResult<PreflightedDocument> {
  if (!isPlainObject(input)) {
    return err([
      issue("document/not-an-object", "Document input must be a JSON object."),
    ]);
  }
  if (input.kind !== "donativus.visual-document") {
    return err([
      issue(
        "document/invalid-kind",
        'Document "kind" must be "donativus.visual-document".',
      ),
    ]);
  }
  if (
    typeof input.schemaVersion !== "number" ||
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion <= 0
  ) {
    return err([
      issue(
        "document/invalid-schema-version",
        'Document "schemaVersion" must be a positive integer.',
      ),
    ]);
  }
  if (input.mode !== "email" && input.mode !== "landing-page") {
    return err([
      issue(
        "document/invalid-mode",
        'Document "mode" must be "email" or "landing-page".',
      ),
    ]);
  }
  if (!isPlainObject(input.nodes)) {
    return err([
      issue("document/invalid-nodes", 'Document "nodes" must be an object.'),
    ]);
  }

  const nodeCount = Object.keys(input.nodes).length;
  if (nodeCount > VISUAL_DOCUMENT_LIMITS.maxNodeCount) {
    return err([
      issue(
        "document/too-many-nodes",
        `Document declares ${nodeCount} nodes, exceeding the maximum.`,
      ),
    ]);
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return err([
      issue(
        "document/unserializable",
        "Document input could not be measured for size.",
      ),
    ]);
  }
  // Core is shared by Node and the browser. `Buffer.byteLength` made every
  // browser-side export fail before parsing; TextEncoder is the portable
  // UTF-8 byte counter in both supported runtimes.
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > VISUAL_DOCUMENT_LIMITS.maxInputBytes) {
    return err([
      issue(
        "document/input-too-large",
        `Document input is ${byteLength} bytes, exceeding the maximum.`,
      ),
    ]);
  }

  for (const [nodeId, node] of Object.entries(input.nodes)) {
    const depth = measureJsonDepth(node, VISUAL_DOCUMENT_LIMITS.maxDepth);
    if (depth === null) {
      return err([
        issue(
          "document/node-too-complex",
          `Node "${nodeId}" exceeds the maximum nesting depth.`,
          { nodeId },
        ),
      ]);
    }
  }

  return ok({ raw: input, nodes: input.nodes });
}

/**
 * Returns the value's nesting depth, or `null` as soon as `maxDepth` is
 * exceeded — bails out early instead of walking the full (potentially
 * adversarial) structure.
 */
function measureJsonDepth(
  value: unknown,
  maxDepth: number,
  depth = 0,
): number | null {
  if (depth > maxDepth) return null;
  if (Array.isArray(value)) {
    let deepest = depth;
    for (const item of value) {
      const itemDepth = measureJsonDepth(item, maxDepth, depth + 1);
      if (itemDepth === null) return null;
      deepest = Math.max(deepest, itemDepth);
    }
    return deepest;
  }
  if (isPlainObject(value)) {
    let deepest = depth;
    for (const item of Object.values(value)) {
      const itemDepth = measureJsonDepth(item, maxDepth, depth + 1);
      if (itemDepth === null) return null;
      deepest = Math.max(deepest, itemDepth);
    }
    return deepest;
  }
  return depth;
}
