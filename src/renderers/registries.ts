// Layers the built-in mode HTML renderers on top of core's built-in
// registries (design.md decision #1). `core` keeps every `ModeDefinition`
// unaware of rendering — `renderer` stays `unknown` there — so this is the
// one place permitted to narrow that slot to a concrete `ModeRenderer` and
// hand the result to `exportVisualDocument`.

import { createBuilderRegistries } from "../core/registry/builder-registries.js";
import { DEFAULT_BUILDER_REGISTRIES } from "../core/registry/default-registries.js";
import { createModeRegistry } from "../core/registry/mode-registry.js";
import type {
  BuilderRegistries,
  ModeDefinition,
} from "../core/registry/types.js";
import { renderEmailDocument } from "./email/index.js";
import { renderLandingDocument } from "./landing/index.js";
import type { ModeRenderer } from "./render-types.js";

function buildDefaultRendererRegistries(): BuilderRegistries {
  const emailMode = DEFAULT_BUILDER_REGISTRIES.modes.get("email");
  const landingPageMode = DEFAULT_BUILDER_REGISTRIES.modes.get("landing-page");
  if (!emailMode || !landingPageMode) {
    throw new Error(
      'Core default registries are missing the "email" or "landing-page" mode definition.',
    );
  }

  const emailModeWithRenderer: ModeDefinition = {
    ...emailMode,
    renderer: renderEmailDocument as ModeRenderer,
  };
  const landingModeWithRenderer: ModeDefinition = {
    ...landingPageMode,
    renderer: renderLandingDocument as ModeRenderer,
  };

  const modesResult = createModeRegistry([
    emailModeWithRenderer,
    landingModeWithRenderer,
  ]);
  if (!modesResult.ok) {
    throw new Error(
      "Failed to attach the built-in email/landing-page renderers to the mode registry.",
    );
  }

  const combined = createBuilderRegistries({
    blocks: DEFAULT_BUILDER_REGISTRIES.blocks,
    modes: modesResult.value,
    variables: DEFAULT_BUILDER_REGISTRIES.variables,
    inspectorControls: DEFAULT_BUILDER_REGISTRIES.inspectorControls,
  });
  if (!combined.ok) {
    throw new Error(
      "Failed to construct the default renderer-aware registries.",
    );
  }
  return combined.value;
}

/** Core's zero-config registries plus the built-in email and landing-page HTML renderers. */
export const DEFAULT_RENDERER_REGISTRIES: BuilderRegistries =
  buildDefaultRendererRegistries();
