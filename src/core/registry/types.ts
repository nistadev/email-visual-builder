// The extension-point contracts (design.md decision #4). Registries are
// constructed per builder instance — there is no global mutable
// registration. `canvasComponent`/`inspectorComponent`/`renderers`/preview
// slots are intentionally `unknown` here so core stays free of React and
// renderer-specific imports; the `react` and `renderers` entrypoints narrow
// these types when they build on top of a registry.

import type { MigrationStep } from "../migrations.js";
import type { ParseResult } from "../result.js";
import type { VariableSyntaxDefinition } from "../variables/token-syntax.js";
import type {
  PositiveInteger,
  VariableDefinition,
  VisualBuilderNode,
  VisualDocumentMode,
  VisualDocumentQualityWarning,
} from "../../types/index.js";

export interface BlockDefinition<TProps = unknown> {
  type: string;
  version: PositiveInteger;
  supportedModes: readonly VisualDocumentMode[];
  /** `true` if this block type may own `children`. */
  isContainer: boolean;
  /** `null` means only the document root may parent this block. */
  allowedParentTypes: readonly string[] | null;
  /** `null` means this block cannot contain children. Ignored when `isContainer` is `false`. */
  allowedChildTypes: readonly string[] | null;
  defaultProps: (mode: VisualDocumentMode) => TProps;
  /**
   * Optional child blocks created atomically with a new container. This is
   * used by layout blocks such as `columns`, whose usable default is a
   * complete two-column region rather than an empty structural shell.
   */
  defaultChildren?: (mode: VisualDocumentMode) => readonly { type: string }[];
  parseProps: (raw: unknown, path: string) => ParseResult<TProps>;
  migrations?: readonly MigrationStep<TProps>[];
  canvasComponent?: unknown;
  inspectorComponent?: unknown;
  renderers?: Partial<Record<VisualDocumentMode, unknown>>;
  qualityChecks?: readonly ((
    node: VisualBuilderNode,
  ) => VisualDocumentQualityWarning[])[];
}

export interface ModeDefinition<TSettings = unknown> {
  mode: VisualDocumentMode;
  defaultSettings: TSettings;
  parseSettings: (raw: unknown, path: string) => ParseResult<TSettings>;
  /** `undefined` means every block whose `supportedModes` includes this mode is allowed. */
  allowedBlockTypes?: readonly string[];
  previewComponent?: unknown;
  renderer?: unknown;
}

export interface InspectorControlDefinition {
  key: string;
  component: unknown;
}

export type VariableRegistryDefinition = VariableDefinition;

export interface Registry<TKey extends string, TDefinition> {
  readonly keys: readonly TKey[];
  has(key: TKey): boolean;
  get(key: TKey): TDefinition | undefined;
  list(): TDefinition[];
}

export type BlockRegistry = Registry<string, BlockDefinition>;
export type ModeRegistry = Registry<VisualDocumentMode, ModeDefinition>;
export type VariableRegistry = Registry<string, VariableRegistryDefinition> & {
  /** The variable-like syntax this registry was constructed with (task 7.3) — defaults to percent-delimited tokens. */
  readonly syntax: VariableSyntaxDefinition;
};
export type InspectorControlRegistry = Registry<
  string,
  InspectorControlDefinition
>;

export interface BuilderRegistries {
  modes: ModeRegistry;
  blocks: BlockRegistry;
  variables: VariableRegistry;
  inspectorControls: InspectorControlRegistry;
}
