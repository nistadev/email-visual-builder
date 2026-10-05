import type { VisualDocumentMode } from "../../types/index.js";
import type { ParseResult } from "../result.js";
import { buildRegistry, type BuildRegistryOptions } from "./build-registry.js";
import type { ModeDefinition, ModeRegistry } from "./types.js";

export function createModeRegistry(
  builtIns: readonly ModeDefinition[],
  plugins: readonly ModeDefinition[] = [],
  options: BuildRegistryOptions<VisualDocumentMode> = {},
): ParseResult<ModeRegistry> {
  return buildRegistry(
    builtIns,
    plugins,
    (definition) => definition.mode,
    options,
  );
}
