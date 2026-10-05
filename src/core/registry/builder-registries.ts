import { err, issue, ok, type ParseResult } from "../result.js";
import type {
  BlockRegistry,
  BuilderRegistries,
  InspectorControlRegistry,
  ModeRegistry,
  VariableRegistry,
} from "./types.js";

/**
 * Bundles the four independently-constructed registries and validates their
 * cross-references — a block declaring a mode that was never registered is
 * a construction-time error, not a silent no-op at parse time.
 */
export function createBuilderRegistries(registries: {
  modes: ModeRegistry;
  blocks: BlockRegistry;
  variables: VariableRegistry;
  inspectorControls: InspectorControlRegistry;
}): ParseResult<BuilderRegistries> {
  const issues = [];

  for (const block of registries.blocks.list()) {
    for (const mode of block.supportedModes) {
      if (!registries.modes.has(mode)) {
        issues.push(
          issue(
            "registry/unknown-mode-dependency",
            `Block "${block.type}" declares support for mode "${mode}", which is not registered.`,
          ),
        );
      }
    }
    if (block.allowedChildTypes) {
      for (const childType of block.allowedChildTypes) {
        if (!registries.blocks.has(childType)) {
          issues.push(
            issue(
              "registry/unknown-block-dependency",
              `Block "${block.type}" allows child type "${childType}", which is not registered.`,
            ),
          );
        }
      }
    }
  }

  for (const mode of registries.modes.list()) {
    for (const blockType of mode.allowedBlockTypes ?? []) {
      if (!registries.blocks.has(blockType)) {
        issues.push(
          issue(
            "registry/unknown-block-dependency",
            `Mode "${mode.mode}" allows block type "${blockType}", which is not registered.`,
          ),
        );
      }
    }
  }

  if (issues.length > 0) return err(issues);
  return ok(registries);
}
