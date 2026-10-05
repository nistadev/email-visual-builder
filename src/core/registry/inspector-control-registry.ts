import type { ParseResult } from "../result.js";
import { buildRegistry, type BuildRegistryOptions } from "./build-registry.js";
import type {
  InspectorControlDefinition,
  InspectorControlRegistry,
} from "./types.js";

export function createInspectorControlRegistry(
  builtIns: readonly InspectorControlDefinition[],
  plugins: readonly InspectorControlDefinition[] = [],
  options: BuildRegistryOptions<string> = {},
): ParseResult<InspectorControlRegistry> {
  return buildRegistry(
    builtIns,
    plugins,
    (definition) => definition.key,
    options,
  );
}
