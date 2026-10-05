import { err, issue, ok, type ParseResult } from "../result.js";
import type { Registry } from "./types.js";

export interface BuildRegistryOptions<TKey extends string> {
  /** Keys that `plugins` are explicitly allowed to override a built-in definition for. */
  replace?: readonly TKey[];
}

/**
 * Constructs an instance-scoped registry from built-in and plugin
 * definitions. Duplicate keys — among built-ins, among plugins, or a plugin
 * colliding with a built-in without an explicit `replace` entry — fail
 * construction outright rather than silently picking a winner (design.md
 * decision #4).
 */
export function buildRegistry<TKey extends string, TDefinition>(
  builtIns: readonly TDefinition[],
  plugins: readonly TDefinition[],
  getKey: (definition: TDefinition) => TKey,
  options: BuildRegistryOptions<TKey> = {},
): ParseResult<Registry<TKey, TDefinition>> {
  const replaceSet = new Set(options.replace ?? []);
  const byKey = new Map<TKey, TDefinition>();
  const builtInKeys = new Set<TKey>();
  const issues = [];

  for (const definition of builtIns) {
    const key = getKey(definition);
    if (byKey.has(key)) {
      issues.push(
        issue(
          "registry/duplicate-key",
          `Duplicate built-in registry key "${key}".`,
        ),
      );
      continue;
    }
    byKey.set(key, definition);
    builtInKeys.add(key);
  }

  const seenPluginKeys = new Set<TKey>();
  for (const definition of plugins) {
    const key = getKey(definition);
    if (seenPluginKeys.has(key)) {
      issues.push(
        issue(
          "registry/duplicate-key",
          `Duplicate plugin registry key "${key}".`,
        ),
      );
      continue;
    }
    seenPluginKeys.add(key);

    const isBuiltIn = builtInKeys.has(key);
    if (isBuiltIn && !replaceSet.has(key)) {
      issues.push(
        issue(
          "registry/duplicate-key",
          `Registry key "${key}" is already a built-in definition; pass it in "replace" to override explicitly.`,
        ),
      );
      continue;
    }
    if (!isBuiltIn && replaceSet.has(key)) {
      issues.push(
        issue(
          "registry/nothing-to-replace",
          `"replace" lists key "${key}" but no built-in definition exists for it.`,
        ),
      );
      continue;
    }
    byKey.set(key, definition);
  }

  if (issues.length > 0) return err(issues);

  const keys = Array.from(byKey.keys());
  return ok({
    keys,
    has: (key: TKey) => byKey.has(key),
    get: (key: TKey) => byKey.get(key),
    list: () => Array.from(byKey.values()),
  });
}
