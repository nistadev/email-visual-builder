import type {
  VisualBuilderNodeRecord,
  VisualDocument,
  VisualDocumentMode,
} from "../types/index.js";
import { DEFAULT_BUILDER_REGISTRIES } from "./registry/default-registries.js";
import type { BuilderRegistries } from "./registry/types.js";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "./versions.js";

/**
 * The minimal valid document for a fresh new-template session: a
 * `document-root` with one empty `section`, using each block's own
 * registry-provided defaults. Both mode presets get one so "start a new
 * email" / "start a new landing page" never needs a hand-built document.
 */
export function createStarterDocument(
  mode: VisualDocumentMode,
  registries: BuilderRegistries = DEFAULT_BUILDER_REGISTRIES,
): VisualDocument {
  const documentRootDefinition = registries.blocks.get("document-root");
  const sectionDefinition = registries.blocks.get("section");
  const modeDefinition = registries.modes.get(mode);
  if (!documentRootDefinition || !sectionDefinition || !modeDefinition) {
    throw new Error(
      `Registries are missing a "document-root"/"section" block or the "${mode}" mode definition.`,
    );
  }

  const nodes = {
    root: {
      id: "root",
      type: "document-root",
      version: documentRootDefinition.version,
      props: documentRootDefinition.defaultProps(mode),
      children: ["section-1"],
    },
    "section-1": {
      id: "section-1",
      type: "section",
      version: sectionDefinition.version,
      props: sectionDefinition.defaultProps(mode),
      children: [],
    },
  } as unknown as VisualBuilderNodeRecord;

  return {
    kind: "donativus.visual-document",
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    mode,
    rootId: "root",
    nodes,
    settings: modeDefinition.defaultSettings,
  } as VisualDocument;
}
