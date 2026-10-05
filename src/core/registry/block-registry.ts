import type { VisualDocumentMode } from "../../types/index.js";
import type { ParseResult } from "../result.js";
import { buildRegistry, type BuildRegistryOptions } from "./build-registry.js";
import type { BlockDefinition, BlockRegistry } from "./types.js";

export function createBlockRegistry(
  builtIns: readonly BlockDefinition[],
  plugins: readonly BlockDefinition[] = [],
  options: BuildRegistryOptions<string> = {},
): ParseResult<BlockRegistry> {
  return buildRegistry(
    builtIns,
    plugins,
    (definition) => definition.type,
    options,
  );
}

export function listBlockTypesForMode(
  registry: BlockRegistry,
  mode: VisualDocumentMode,
): string[] {
  return registry
    .list()
    .filter((definition) => definition.supportedModes.includes(mode))
    .map((definition) => definition.type);
}
