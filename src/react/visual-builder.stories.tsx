// Storybook stories for the two editor presets (task 12.11): standalone
// visual iteration plus manual keyboard/screen-reader QA before the
// a host integration lands. Variables mirror the marketing adapter's
// `%recipient.<key>%` shape without importing anything from the apps.

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { VariableDefinition, VisualDocumentMode } from "../types/index.js";
import { useMemo, useState } from "react";
import { BuilderController } from "../core/controller/controller.js";
import { createStarterDocument } from "../core/starter-document.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";
import { createVariableRegistry } from "../core/registry/variable-registry.js";
import { createBuilderRegistries } from "../core/registry/builder-registries.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import type { AssetAdapter } from "./asset-adapter.js";
import { EmailVisualBuilder, LandingPageVisualBuilder } from "./presets.js";
import { useBuilderActions } from "./provider.js";

const SAMPLE_VARIABLES: VariableDefinition[] = [
  {
    key: "recipient.firstName",
    token: "%recipient.firstName%",
    label: "First name",
    sampleValue: "Ada",
    allowedContexts: ["text"],
  },
  {
    key: "recipient.email",
    token: "%recipient.email%",
    label: "Email address",
    sampleValue: "ada@example.org",
    allowedContexts: ["text"],
  },
  {
    key: "mailing_list_unsubscribe_url",
    token: "%mailing_list_unsubscribe_url%",
    label: "Unsubscribe link",
    allowedContexts: ["url", "email-system-link"],
  },
];

function registriesWithVariables(): BuilderRegistries {
  const variablesResult = createVariableRegistry(SAMPLE_VARIABLES);
  if (!variablesResult.ok)
    throw new Error("Sample variables failed registry validation.");
  const combined = createBuilderRegistries({
    blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
    modes: DEFAULT_RENDERER_REGISTRIES.modes,
    variables: variablesResult.value,
    inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
  });
  if (!combined.ok) throw new Error("Sample registries failed validation.");
  return combined.value;
}

/** A populated demo document so stories open with content to select, drag, and inspect. */
function createDemoController(
  mode: VisualDocumentMode,
  registries: BuilderRegistries,
): BuilderController {
  const controller = new BuilderController(
    createStarterDocument(mode, registries),
    { registries },
  );
  const dispatch = (
    command: Parameters<BuilderController["dispatch"]>[0],
  ): void => {
    const result = controller.dispatch(command);
    if (!result.ok)
      throw new Error(
        `Demo document setup failed: ${result.issues[0]?.message}`,
      );
  };

  const section = controller.getState().document.nodes["section-1"];
  dispatch({
    type: "update-node-props",
    nodeId: "section-1",
    props: {
      ...(section?.props as Record<string, unknown>),
      shadow: {
        offsetXPx: 0,
        offsetYPx: 8,
        blurPx: 30,
        spreadPx: -15,
        color: "#b3b3b3",
      },
    },
  });

  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "heading",
    nodeId: "demo-heading",
  });
  const heading = controller.getState().document.nodes["demo-heading"];
  dispatch({
    type: "update-node-props",
    nodeId: "demo-heading",
    props: {
      ...(heading?.props as Record<string, unknown>),
      text: {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "left",
            children: [
              { type: "text", text: "Welcome, ", marks: [] },
              {
                type: "variable",
                variableKey: "recipient.firstName",
                token: "%recipient.firstName%",
              },
            ],
          },
        ],
      },
    },
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "rich-text",
    nodeId: "demo-text",
  });
  const richText = controller.getState().document.nodes["demo-text"];
  dispatch({
    type: "update-rich-text",
    nodeId: "demo-text",
    value: {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "text",
              text: "Thanks for supporting our cause. ",
              marks: [],
            },
            { type: "text", text: "Every donation counts.", marks: ["bold"] },
          ],
        },
      ],
    },
  });
  void richText;
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "columns",
    nodeId: "demo-columns",
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "cta",
    nodeId: "demo-cta",
  });
  const cta = controller.getState().document.nodes["demo-cta"];
  dispatch({
    type: "update-node-props",
    nodeId: "demo-cta",
    props: {
      ...(cta?.props as Record<string, unknown>),
      label: {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "left",
            children: [{ type: "text", text: "Donate now", marks: [] }],
          },
        ],
      },
      destination: {
        segments: [{ kind: "literal", value: "https://example.org/donate" }],
      },
      align: "center",
    },
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "image",
    nodeId: "demo-image",
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "divider",
    nodeId: "demo-divider",
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "social",
    nodeId: "demo-social",
  });
  const social = controller.getState().document.nodes["demo-social"];
  dispatch({
    type: "update-node-props",
    nodeId: "demo-social",
    props: {
      ...(social?.props as Record<string, unknown>),
      items: [
        {
          id: "demo-social-facebook",
          platform: "facebook",
          url: "https://facebook.com/example",
        },
        {
          id: "demo-social-instagram",
          platform: "instagram",
          url: "https://instagram.com/example",
        },
        {
          id: "demo-social-x",
          platform: "x",
          url: "https://x.com/example",
        },
        {
          id: "demo-social-website",
          platform: "website",
          url: "https://example.org",
        },
      ],
      iconStyle: "filled",
      shape: "circle",
      align: "center",
    },
  });
  dispatch({
    type: "insert-node",
    parentId: "section-1",
    blockType: "spacer",
    nodeId: "demo-spacer",
  });
  controller.setSelection(null);
  return controller;
}

/**
 * Storybook stub for the injected asset adapter (task 13.1): no backend —
 * a successful "upload" resolves to an object URL of the (possibly
 * pre-edited) local file after a short latency, so the canvas actually
 * shows the image. `failNextUploads` simulates storage failures to exercise
 * the error/retry state and previous-asset preservation.
 */
function createStubAssetAdapter(options?: {
  latencyMs?: number;
  failNextUploads?: number;
}): AssetAdapter {
  let remainingFailures = options?.failNextUploads ?? 0;
  const latencyMs = options?.latencyMs ?? 800;
  return {
    async uploadImage(file) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        return {
          ok: false,
          error: `Stubbed storage failure (${remainingFailures} more before success)`,
        };
      }
      let widthPx: number | undefined;
      let heightPx: number | undefined;
      try {
        const bitmap = await createImageBitmap(file);
        widthPx = bitmap.width;
        heightPx = bitmap.height;
        bitmap.close();
      } catch {
        // Dimensions stay optional.
      }
      return {
        ok: true,
        asset: {
          url: URL.createObjectURL(file),
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          ...(widthPx && heightPx ? { widthPx, heightPx } : {}),
        },
      };
    },
  };
}

function SaveAction(): React.JSX.Element {
  const actions = useBuilderActions();
  return (
    <button
      type="button"
      className="btn btn-sm btn-primary"
      onClick={() => {
        const result = actions.export();
        // Storybook-only demonstration of the consumer save flow.
        console.info("export result", result);
      }}
    >
      Save
    </button>
  );
}

function EmailStory({
  layout,
  assetAdapter,
}: {
  layout?: "auto" | "wide" | "narrow";
  assetAdapter?: AssetAdapter;
}): React.JSX.Element {
  const registries = useMemo(registriesWithVariables, []);
  const controller = useMemo(
    () => createDemoController("email", registries),
    [registries],
  );
  const [senderName, setSenderName] = useState("Donativus");
  const [subject, setSubject] = useState("A little goes a long way");
  return (
    <div style={{ height: "100vh" }}>
      <EmailVisualBuilder
        controller={controller}
        registries={registries}
        variables={SAMPLE_VARIABLES}
        layout={layout}
        assetAdapter={assetAdapter}
        senderName={senderName}
        senderEmail="hello@donativus.com"
        subject={subject}
        onSenderNameChange={setSenderName}
        onSubjectChange={setSubject}
        toolbarActions={<SaveAction />}
      />
    </div>
  );
}

function LandingStory(): React.JSX.Element {
  const registries = useMemo(registriesWithVariables, []);
  const controller = useMemo(
    () => createDemoController("landing-page", registries),
    [registries],
  );
  return (
    <div style={{ height: "100vh" }}>
      <LandingPageVisualBuilder
        controller={controller}
        registries={registries}
        variables={SAMPLE_VARIABLES}
        toolbarActions={<SaveAction />}
      />
    </div>
  );
}

const meta: Meta = {
  title: "VisualBuilder/Editor presets",
};
export default meta;

export const EmailEditor: StoryObj = {
  render: () => <EmailStory />,
};

export const EmailEditorNarrow: StoryObj = {
  render: () => <EmailStory layout="narrow" />,
};

/**
 * Section 13 QA: select the Image block, keep the "Upload" source mode,
 * choose a local file, and walk the pre-upload crop/rotate/resize step.
 * The stub adapter resolves after ~800ms with an object URL, so the
 * canvas shows the uploaded (edited) image. Toggle to "URL" mode to enter
 * a direct address instead.
 */
export const EmailEditorWithUploads: StoryObj = {
  render: () => <EmailStory assetAdapter={createStubAssetAdapter()} />,
};

/**
 * Section 13 QA: the stub adapter fails the first two uploads to exercise
 * the structured error alert, the retry action, and previous-durable-asset
 * preservation; the third attempt succeeds.
 */
export const EmailEditorWithFailingUploads: StoryObj = {
  render: () => (
    <EmailStory assetAdapter={createStubAssetAdapter({ failNextUploads: 2 })} />
  ),
};

export const LandingPageEditor: StoryObj = {
  render: () => <LandingStory />,
};
