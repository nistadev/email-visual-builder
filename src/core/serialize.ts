import type { VisualDocument } from "../types/index.js";
import { isPlainObject } from "./primitives.js";

/**
 * Recursively rebuilds a value with object keys sorted so that repeated
 * serialization of the same document produces byte-identical output
 * regardless of insertion order (design.md decision #10). `VisualDocument`
 * never carries transient editor state (selection/hover/history/preview
 * device), so there is nothing to strip here — the type itself excludes it.
 */
function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalizeValue(value[key]);
    }
    return result;
  }
  return value;
}

export function serializeVisualDocument(document: VisualDocument): string {
  return JSON.stringify(canonicalizeValue(document));
}
