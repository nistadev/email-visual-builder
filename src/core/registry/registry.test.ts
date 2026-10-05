import assert from "node:assert/strict";
import test from "node:test";
import { parseVisualDocument } from "../parse-document.js";
import { serializeVisualDocument } from "../serialize.js";
import { collectUnavailableNodeIssues } from "../unavailable-nodes.js";
import { createValidEmailDocumentInput } from "../../test-utils/visual-document-fixture.js";
import { createBlockRegistry } from "./block-registry.js";
import { createBuilderRegistries } from "./builder-registries.js";
import { createInspectorControlRegistry } from "./inspector-control-registry.js";
import { createModeRegistry } from "./mode-registry.js";
import { createVariableRegistry } from "./variable-registry.js";
import { DEFAULT_BUILDER_REGISTRIES } from "./default-registries.js";
import type { BlockDefinition } from "./types.js";

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = (code: string) => ({
  ok: false as const,
  issues: [{ code, message: code }],
});

interface BadgeProps {
  label: string;
}

function badgeBlock(
  overrides: Partial<BlockDefinition<BadgeProps>> = {},
): BlockDefinition<BadgeProps> {
  return {
    type: "badge",
    version: 1,
    supportedModes: ["email"],
    isContainer: false,
    allowedParentTypes: ["section"],
    allowedChildTypes: null,
    defaultProps: () => ({ label: "New" }),
    parseProps: (raw) => {
      if (
        typeof raw === "object" &&
        raw !== null &&
        typeof (raw as { label?: unknown }).label === "string"
      ) {
        return ok({ label: (raw as { label: string }).label });
      }
      return err("value/invalid-badge");
    },
    ...overrides,
  };
}

function registriesWithPlugins(
  plugins: readonly BlockDefinition[],
  options: { replace?: readonly string[] } = {},
) {
  const blocks = createBlockRegistry(
    DEFAULT_BUILDER_REGISTRIES.blocks.list(),
    plugins,
    options,
  );
  if (!blocks.ok) return blocks;
  return createBuilderRegistries({
    blocks: blocks.value,
    modes: DEFAULT_BUILDER_REGISTRIES.modes,
    variables: DEFAULT_BUILDER_REGISTRIES.variables,
    inspectorControls: DEFAULT_BUILDER_REGISTRIES.inspectorControls,
  });
}

test.describe("plugin blocks — registration", () => {
  test("a consumer-registered custom block restores, parses, and round-trips in one mode", () => {
    const registries = registriesWithPlugins([badgeBlock()]);
    assert.equal(registries.ok, true);
    if (!registries.ok) return;

    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, any>;
    nodes["section-1"].children.push("badge-1");
    nodes["badge-1"] = {
      id: "badge-1",
      type: "badge",
      version: 1,
      props: { label: "Featured" },
    };

    const result = parseVisualDocument(input, registries.value);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const badgeNode = result.value.nodes["badge-1"];
    assert.deepEqual((badgeNode as { props: unknown }).props, {
      label: "Featured",
    });
    assert.ok(!("unavailable" in badgeNode));

    // Round-trips through canonical serialization.
    const json = serializeVisualDocument(result.value);
    const reparsed = parseVisualDocument(JSON.parse(json), registries.value);
    assert.equal(reparsed.ok, true);
  });

  test("a custom block with malformed props reports a parse issue", () => {
    const registries = registriesWithPlugins([badgeBlock()]);
    assert.equal(registries.ok, true);
    if (!registries.ok) return;

    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, any>;
    nodes["section-1"].children.push("badge-1");
    nodes["badge-1"] = {
      id: "badge-1",
      type: "badge",
      version: 1,
      props: { label: 42 },
    };

    const result = parseVisualDocument(input, registries.value);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "value/invalid-badge"),
    );
  });

  test("two plugins claiming the same block type fail registry construction", () => {
    const result = registriesWithPlugins([
      badgeBlock(),
      badgeBlock({ version: 2 }),
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "registry/duplicate-key"),
    );
  });

  test("a plugin colliding with a built-in type fails without explicit replacement", () => {
    const impostorSection = badgeBlock({ type: "section" });
    const result = registriesWithPlugins([impostorSection]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "registry/duplicate-key"),
    );
  });

  test("explicit replacement lets a plugin override a built-in definition", () => {
    const replacementSection = badgeBlock({
      type: "section",
      supportedModes: ["email", "landing-page"],
    });
    const result = registriesWithPlugins([replacementSection], {
      replace: ["section"],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.blocks.get("section"), replacementSection);
  });

  test("requesting replacement of a type with no built-in definition fails", () => {
    const result = registriesWithPlugins([badgeBlock()], {
      replace: ["badge"],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "registry/nothing-to-replace",
      ),
    );
  });

  test("a block declaring an unregistered mode fails builder-registry construction", () => {
    const blocks = createBlockRegistry([
      badgeBlock({ supportedModes: ["email", "sms" as never] }),
    ]);
    assert.equal(blocks.ok, true);
    if (!blocks.ok) return;
    const modes = createModeRegistry(DEFAULT_BUILDER_REGISTRIES.modes.list());
    assert.equal(modes.ok, true);
    if (!modes.ok) return;
    const variables = createVariableRegistry([]);
    const inspectorControls = createInspectorControlRegistry([]);
    if (!variables.ok || !inspectorControls.ok) return;

    const result = createBuilderRegistries({
      blocks: blocks.value,
      modes: modes.value,
      variables: variables.value,
      inspectorControls: inspectorControls.value,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "registry/unknown-mode-dependency",
      ),
    );
  });

  test("a block with no canvas/inspector renderer registered is still constructible and parseable", () => {
    // "Missing renderer" is a valid, supported state at the registry layer —
    // canvas/inspector/mode-renderer slots are optional until sections
    // 6/8-12 populate them. A block that never sets any of them must still
    // register and parse successfully.
    const bareBlock = badgeBlock();
    assert.equal(bareBlock.canvasComponent, undefined);
    assert.equal(bareBlock.inspectorComponent, undefined);
    assert.equal(bareBlock.renderers, undefined);

    const registries = registriesWithPlugins([bareBlock]);
    assert.equal(registries.ok, true);
  });
});

test.describe("plugin blocks — unavailable round trip", () => {
  test("a node whose plugin is unavailable is preserved, not discarded, and blocks strict export", () => {
    const registries = registriesWithPlugins([badgeBlock()]);
    assert.equal(registries.ok, true);
    if (!registries.ok) return;

    const input = createValidEmailDocumentInput();
    const nodes = input.nodes as Record<string, any>;
    nodes["section-1"].children.push("badge-1");
    nodes["badge-1"] = {
      id: "badge-1",
      type: "badge",
      version: 1,
      props: { label: "Featured" },
    };

    // Parsed once with the plugin present...
    const withPlugin = parseVisualDocument(input, registries.value);
    assert.equal(withPlugin.ok, true);
    if (!withPlugin.ok) return;
    const json = serializeVisualDocument(withPlugin.value);

    // ...then restored later without the plugin registered.
    const withoutPlugin = parseVisualDocument(
      JSON.parse(json),
      DEFAULT_BUILDER_REGISTRIES,
    );
    assert.equal(withoutPlugin.ok, true);
    if (!withoutPlugin.ok) return;

    const preserved = withoutPlugin.value.nodes["badge-1"];
    assert.ok("unavailable" in preserved && preserved.unavailable === true);
    assert.deepEqual((preserved as { props: unknown }).props, {
      label: "Featured",
    });

    const exportIssues = collectUnavailableNodeIssues(withoutPlugin.value);
    assert.ok(
      exportIssues.some(
        (issue) =>
          issue.code === "document/unsupported-block" &&
          issue.nodeId === "badge-1",
      ),
    );
  });
});
