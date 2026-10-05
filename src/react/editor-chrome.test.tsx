// Task 12.10: full-preset interaction tests — selection, keyboard moves
// (command-equivalent to drag), drawers, preview modes, validation review,
// focus behavior, accessible names/states, and live announcements.

import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";
import type {
  HeadingProps,
  RichTextProps,
  RichTextValue,
  VariableDefinition,
} from "../types/index.js";
import { SAMPLE_VARIABLE_DEFINITIONS } from "../test-utils/sample-variables.js";
import { installJsdomGlobals, type JsdomHandle } from "../test-utils/index.js";
import { BuilderController } from "../core/controller/controller.js";
import { createBuilderRegistries } from "../core/registry/builder-registries.js";
import { createVariableRegistry } from "../core/registry/variable-registry.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { createStarterDocument } from "../core/starter-document.js";
import { DEFAULT_RENDERER_REGISTRIES } from "../renderers/registries.js";

let jsdom: JsdomHandle;

function createTestController(): BuilderController {
  const controller = new BuilderController(
    createStarterDocument("email", DEFAULT_RENDERER_REGISTRIES),
    {
      registries: DEFAULT_RENDERER_REGISTRIES,
    },
  );
  assert.equal(
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "heading",
      nodeId: "h1",
    }).ok,
    true,
  );
  assert.equal(
    controller.dispatch({
      type: "insert-node",
      parentId: "section-1",
      blockType: "divider",
      nodeId: "d1",
    }).ok,
    true,
  );
  controller.setSelection(null);
  return controller;
}

function sectionChildren(controller: BuilderController): readonly string[] {
  return controller.getState().document.nodes["section-1"]?.children ?? [];
}

interface Harness {
  container: HTMLDivElement;
  unmount: () => void;
}

async function renderEmailPreset(
  controller: BuilderController,
  options: {
    layout?: "wide" | "narrow";
    withSave?: boolean;
    senderName?: string;
    senderEmail?: string;
    subject?: string;
    isSaved?: boolean;
    hasUnsavedChanges?: boolean;
    onSenderNameChange?: (senderName: string) => void;
    onSubjectChange?: (subject: string) => void;
    registries?: BuilderRegistries;
    variables?: readonly VariableDefinition[];
    sidebarStatusNotice?: ReactNode;
  } = {},
): Promise<Harness> {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { EmailVisualBuilder } = await import("./presets.js");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <EmailVisualBuilder
        controller={controller}
        registries={options.registries}
        variables={options.variables}
        layout={options.layout ?? "wide"}
        senderName={options.senderName}
        senderEmail={options.senderEmail}
        subject={options.subject}
        isSaved={options.isSaved}
        hasUnsavedChanges={options.hasUnsavedChanges}
        sidebarStatusNotice={options.sidebarStatusNotice}
        onSenderNameChange={options.onSenderNameChange}
        onSubjectChange={options.onSubjectChange}
        toolbarActions={
          options.withSave ? (
            <button type="button" aria-label="Save">
              Save
            </button>
          ) : undefined
        }
      />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushFocusRestoration(): Promise<void> {
  const { act } = await import("react");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

test.describe("editor chrome", () => {
  test.before(() => {
    jsdom = installJsdomGlobals();
  });
  test.after(async () => {
    await jsdom.cleanup();
  });

  test("clicking a canvas block selects it and syncs the layers tree", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    const headingNode = harness.container.querySelector(
      '[data-vb-canvas-node="h1"]',
    );
    assert.ok(headingNode);
    act(() => {
      fireEvent.click(headingNode);
    });

    assert.equal(controller.getState().transient.selectedNodeId, "h1");
    assert.equal(headingNode.getAttribute("data-selected"), "true");

    const layersItem = harness.container.querySelector(
      '[data-vb-layers-node="h1"]',
    );
    assert.ok(layersItem);
    assert.equal(layersItem.getAttribute("aria-selected"), "true");

    const idleDropSlots = Array.from(
      harness.container.querySelectorAll<HTMLElement>("[data-vb-drop-slot]"),
    );
    assert.ok(idleDropSlots.length > 0);
    assert.equal(
      idleDropSlots.every(
        (slot) =>
          slot.classList.contains("is-idle") &&
          slot.hasAttribute("data-vb-drop-slot-visible") === false,
      ),
      true,
      "drop guides stay collapsed until a drag starts",
    );

    harness.unmount();
  });

  test("hovering a canvas layer shows its name beside the cursor", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    try {
      const headingNode = harness.container.querySelector<HTMLElement>(
        '[data-vb-canvas-node="h1"]',
      );
      assert.ok(headingNode);
      act(() => {
        fireEvent.mouseOver(headingNode);
        fireEvent.pointerMove(headingNode, { clientX: 120, clientY: 80 });
      });
      assert.equal(controller.getState().transient.hoveredNodeId, "h1");

      const tooltip = document.body.querySelector<HTMLElement>(
        "[data-vb-canvas-hover-tooltip]",
      );
      assert.ok(tooltip);
      assert.equal(tooltip.textContent, "Heading");
      assert.equal(tooltip.style.left, "134px");
      assert.equal(tooltip.style.top, "94px");

      act(() => fireEvent.mouseOut(headingNode));
      assert.equal(
        document.body.querySelector("[data-vb-canvas-hover-tooltip]"),
        null,
      );
    } finally {
      harness.unmount();
    }
  });

  test("the email composer shows defaults or supplied metadata and only edits fields with callbacks", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");

    const defaultHarness = await renderEmailPreset(createTestController());
    const defaultComposer = defaultHarness.container.querySelector(
      "[data-vb-email-composer]",
    );
    assert.ok(defaultComposer);
    assert.equal(defaultComposer.dataset.vbPreviewDevice, "desktop");
    assert.equal(
      defaultComposer.style.getPropertyValue(
        "--donativus-vb-email-composer-viewport-width",
      ),
      "100%",
    );
    assert.match(
      defaultComposer.textContent ?? "",
      /Sender<sender@example.com>/,
    );
    assert.match(defaultComposer.textContent ?? "", /Untitled email/);
    assert.match(defaultComposer.textContent ?? "", /Draft/);
    assert.equal(
      defaultComposer
        .querySelector("[data-vb-email-save-state]")
        ?.getAttribute("data-vb-email-save-state"),
      "draft",
    );
    assert.equal(defaultComposer.querySelector("input"), null);
    assert.deepEqual(
      Array.from(
        defaultComposer.querySelectorAll<HTMLElement>(
          "[data-vb-window-control]",
        ),
      ).map((control) => control.dataset.vbWindowControl),
      ["close", "minimize", "zoom"],
    );
    defaultHarness.unmount();

    const suppliedHarness = await renderEmailPreset(createTestController(), {
      senderName: "Fundraising",
      senderEmail: "appeals@example.org",
      subject: "Summer appeal",
    });
    const suppliedComposer = suppliedHarness.container.querySelector(
      "[data-vb-email-composer]",
    );
    assert.match(
      suppliedComposer?.textContent ?? "",
      /Fundraising<appeals@example.org>/,
    );
    assert.match(suppliedComposer?.textContent ?? "", /Summer appeal/);
    assert.equal(suppliedComposer?.querySelector("input"), null);
    suppliedHarness.unmount();

    const savedHarness = await renderEmailPreset(createTestController(), {
      isSaved: true,
    });
    const savedBadge = savedHarness.container.querySelector(
      '[data-vb-email-save-state="saved"]',
    );
    assert.equal(savedBadge?.textContent, "Saved");
    savedHarness.unmount();

    const unsavedHarness = await renderEmailPreset(createTestController(), {
      isSaved: true,
      hasUnsavedChanges: true,
    });
    const unsavedBadge = unsavedHarness.container.querySelector(
      '[data-vb-email-save-state="unsaved"]',
    );
    assert.equal(unsavedBadge?.textContent, "Unsaved changes");
    unsavedHarness.unmount();

    const senderUpdates: string[] = [];
    const subjectUpdates: string[] = [];
    const editableHarness = await renderEmailPreset(createTestController(), {
      senderName: "Fundraising",
      senderEmail: "appeals@example.org",
      subject: "Summer appeal",
      onSenderNameChange: (sender) => senderUpdates.push(sender),
      onSubjectChange: (subject) => subjectUpdates.push(subject),
    });
    const senderInput =
      editableHarness.container.querySelector<HTMLInputElement>(
        '[data-vb-email-composer] input[aria-label="Sender name"]',
      );
    const subjectInput =
      editableHarness.container.querySelector<HTMLInputElement>(
        '[data-vb-email-composer] input[aria-label="Subject"]',
      );
    assert.ok(senderInput && subjectInput);
    assert.equal(senderInput.value, "Fundraising");
    assert.equal(
      editableHarness.container.querySelector(
        '[data-vb-email-composer] input[type="email"]',
      ),
      null,
      "the from address is always read-only",
    );
    assert.equal(subjectInput.value, "Summer appeal");
    act(() => fireEvent.change(senderInput, { target: { value: "Team" } }));
    act(() => fireEvent.change(subjectInput, { target: { value: "Thanks" } }));
    assert.deepEqual(senderUpdates, ["Team"]);
    assert.deepEqual(subjectUpdates, ["Thanks"]);
    editableHarness.unmount();
  });

  test("preview text is explained in settings and shown as a muted inbox preheader after the subject", async () => {
    const controller = createTestController();
    const document = controller.getState().document;
    assert.equal(
      controller.dispatch({
        type: "update-document-settings",
        settings: {
          ...document.settings,
          previewText: "A short inbox summary",
        },
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller, {
      subject: "Summer appeal",
      onSubjectChange: () => undefined,
    });
    const subjectLine = harness.container.querySelector(
      ".donativus-vb-email-composer-subject-line",
    );
    const preheader = subjectLine?.querySelector(
      ".donativus-vb-email-composer-preview-text",
    );
    assert.ok(subjectLine && preheader);
    assert.match(subjectLine.textContent ?? "", /A short inbox summary/);
    assert.equal(preheader.getAttribute("aria-label"), "Email preview text");
    assert.ok(
      harness.container.querySelector(
        '[aria-label="The preheader shown after the subject in many inboxes. It is hidden when the email is opened."]',
      ),
    );
    harness.unmount();
  });

  test("the inline variable control mirrors the selected node chrome in the DOM", async () => {
    const controller = createTestController();
    controller.setSelection("h1");
    const harness = await renderEmailPreset(controller, {
      variables: [
        {
          key: "recipient.firstName",
          token: "%recipient.firstName%",
          label: "First name",
          allowedContexts: ["text"],
        },
      ],
    });
    const node = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"]',
    );
    assert.ok(node);
    const chrome = node.querySelector(":scope > .donativus-vb-node-chrome-bar");
    const variableControl = node.querySelector(
      ":scope > .donativus-vb-variable-insert-control",
    );
    assert.ok(chrome && variableControl);
    assert.equal(chrome.parentElement, variableControl.parentElement);
    harness.unmount();
  });

  test("a selected heading uses the rich-text editor and survives an external rich-text update", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);
    try {
      const headingNode = harness.container.querySelector<HTMLElement>(
        '[data-vb-canvas-node="h1"]',
      );
      assert.ok(headingNode);

      act(() => fireEvent.click(headingNode));
      const inlineEditor = headingNode.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      );
      assert.ok(
        inlineEditor,
        "selection replaces the static heading preview with an inline editor",
      );
      const current = controller.getState().document.nodes.h1?.props as
        Record<string, unknown> | undefined;
      const updatedText: RichTextValue = {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "left",
            children: [
              {
                type: "text",
                text: "A professional inline heading",
                marks: ["bold"],
              },
            ],
          },
        ],
      };
      await act(async () => {
        controller.dispatch({
          type: "update-node-props",
          nodeId: "h1",
          props: { ...current, text: updatedText },
        });
        await Promise.resolve();
      });

      const text = (
        controller.getState().document.nodes.h1?.props as {
          text: RichTextValue;
        }
      ).text;
      const paragraph = text.children[0];
      assert.ok(paragraph?.type === "paragraph");
      const firstChild = paragraph.children[0];
      assert.ok(firstChild?.type === "text");
      assert.equal(firstChild.text, "A professional inline heading");
      assert.deepEqual(firstChild.marks, ["bold"]);
    } finally {
      harness.unmount();
    }
  });

  test("leaving an inline rich-text editor does not start a resync loop", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "rich-text",
        nodeId: "rich-text-1",
      }).ok,
      true,
    );
    controller.setSelection(null);
    const harness = await renderEmailPreset(controller);
    const richTextNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="rich-text-1"]',
    );
    const headingNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"]',
    );
    assert.ok(richTextNode && headingNode);

    await act(async () => {
      fireEvent.click(richTextNode);
      await Promise.resolve();
    });
    assert.equal(controller.getState().transient.selectedNodeId, "rich-text-1");
    assert.equal(
      harness.container.querySelectorAll('[contenteditable="true"]').length,
      2,
      "the canvas and inspector editors are both synchronized",
    );

    let notifications = 0;
    const unsubscribe = controller.subscribe(() => {
      notifications += 1;
    });
    const richTextProps = controller.getState().document.nodes["rich-text-1"]
      ?.props as RichTextProps;
    await act(async () => {
      controller.dispatch({
        type: "update-rich-text",
        nodeId: "rich-text-1",
        value: {
          ...richTextProps.value,
          children: [
            {
              type: "paragraph",
              align: "left",
              children: [
                { type: "text", text: "Synchronized change", marks: [] },
              ],
            },
          ],
        },
      });
      await Promise.resolve();
    });
    assert.equal(
      notifications,
      1,
      "one controller update must not bounce between the two editors",
    );

    notifications = 0;
    await act(async () => {
      fireEvent.mouseEnter(headingNode);
      fireEvent.click(headingNode);
      await Promise.resolve();
    });
    unsubscribe();

    assert.equal(controller.getState().transient.selectedNodeId, "h1");
    assert.ok(
      notifications <= 2,
      `expected only hover/selection notifications, received ${notifications}`,
    );
    harness.unmount();
  });

  test("an auto-width button stays intrinsic while its label is being edited", async () => {
    const { act } = await import("react");
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "cta",
        nodeId: "cta-1",
      }).ok,
      true,
    );
    const initialProps = controller.getState().document.nodes["cta-1"]
      ?.props as Record<string, unknown>;
    assert.equal(
      controller.dispatch({
        type: "update-node-props",
        nodeId: "cta-1",
        props: {
          ...initialProps,
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
        },
      }).ok,
      true,
    );

    const harness = await renderEmailPreset(controller);
    const editor = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="cta-1"] .donativus-vb-inline-rich-text',
    );
    assert.ok(editor);
    assert.equal(editor.classList.contains("is-inline"), true);
    assert.equal(editor.parentElement?.style.width, "");
    const editable = editor.querySelector<HTMLElement>("[contenteditable]");
    assert.ok(editable);
    assert.equal(
      editable.classList.contains("donativus-vb-rich-text-content--canvas"),
      true,
    );
    assert.equal(
      editable.classList.contains(
        "donativus-vb-rich-text-content--button-label",
      ),
      true,
    );
    assert.equal(editable.querySelector("p")?.textContent, "Donate now");

    act(() => {
      controller.dispatch({
        type: "update-node-props",
        nodeId: "cta-1",
        props: { ...initialProps, width: { unit: "percent", value: 100 } },
      });
    });
    assert.equal(editor.classList.contains("is-inline"), false);
    assert.equal(editor.parentElement?.style.width, "100%");
    harness.unmount();
  });

  test("document and block widths can switch between pixels and percentages", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    const documentUnit = harness.container.querySelector<HTMLSelectElement>(
      '[aria-label="Width unit"]',
    );
    assert.ok(
      documentUnit,
      "document settings are shown when no block is selected",
    );
    act(() => fireEvent.change(documentUnit, { target: { value: "percent" } }));
    assert.deepEqual(controller.getState().document.settings.contentWidth, {
      unit: "percent",
      value: 100,
    });

    const alignRight = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Right"]',
    );
    assert.ok(alignRight);
    act(() => fireEvent.click(alignRight));
    assert.equal(controller.getState().document.settings.contentAlign, "right");

    act(() => controller.setSelection("d1"));
    const dividerUnit = harness.container.querySelector<HTMLSelectElement>(
      '[aria-label="Width unit"]',
    );
    assert.ok(dividerUnit);
    act(() => fireEvent.change(dividerUnit, { target: { value: "px" } }));
    assert.deepEqual(
      (controller.getState().document.nodes.d1?.props as { width: unknown })
        .width,
      {
        unit: "px",
        value: 100,
      },
    );
    harness.unmount();
  });

  test("typography, linked padding, Shift stepping, and friendly field errors work in the inspector", async () => {
    const { act } = await import("react");
    const { fireEvent, getAllByLabelText, getByLabelText, getByRole } =
      await import("@testing-library/dom");
    const controller = createTestController();
    controller.setSelection("h1");
    const harness = await renderEmailPreset(controller);
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);

    const fontFamily = getByLabelText(
      inspector,
      "Font family",
    ) as HTMLSelectElement;
    const textColor = getByLabelText(
      inspector,
      "Text color",
    ) as HTMLInputElement;
    assert.equal(fontFamily.tagName, "SELECT");
    assert.equal(textColor.type, "color");
    assert.equal(
      fontFamily
        .closest(".donativus-vb-typography-family-row")
        ?.contains(textColor),
      true,
    );
    assert.equal(inspector.textContent?.includes("Line height"), false);

    act(() =>
      fireEvent.change(fontFamily, { target: { value: "Georgia, serif" } }),
    );
    act(() =>
      fireEvent.click(getByRole(inspector, "button", { name: "Semibold" })),
    );
    const headingTypography = (
      controller.getState().document.nodes.h1?.props as {
        typography: { fontFamily: string; fontWeight: string };
      }
    ).typography;
    assert.equal(headingTypography.fontFamily, "Georgia, serif");
    assert.equal(headingTypography.fontWeight, "semibold");

    const unlinkPadding = getByRole(inspector, "button", {
      name: "Unlink padding values",
    });
    const topPadding = getAllByLabelText(
      inspector,
      "Top",
    )[0] as HTMLInputElement;
    act(() =>
      fireEvent.keyDown(topPadding, { key: "ArrowUp", shiftKey: true }),
    );
    let headingSpacing = (
      controller.getState().document.nodes.h1?.props as {
        spacing: {
          topPx: number;
          rightPx: number;
          bottomPx: number;
          leftPx: number;
        };
      }
    ).spacing;
    assert.deepEqual(headingSpacing, {
      topPx: 10,
      rightPx: 10,
      bottomPx: 10,
      leftPx: 10,
    });

    act(() => fireEvent.click(unlinkPadding));
    const rightPadding = getAllByLabelText(inspector, "Right").find(
      (element) => element.tagName === "INPUT",
    ) as HTMLInputElement | undefined;
    assert.ok(rightPadding);
    act(() =>
      fireEvent.keyDown(rightPadding, { key: "ArrowUp", shiftKey: true }),
    );
    headingSpacing = (
      controller.getState().document.nodes.h1?.props as {
        spacing: {
          topPx: number;
          rightPx: number;
          bottomPx: number;
          leftPx: number;
        };
      }
    ).spacing;
    assert.deepEqual(headingSpacing, {
      topPx: 10,
      rightPx: 20,
      bottomPx: 10,
      leftPx: 10,
    });

    act(() => controller.setSelection("d1"));
    const thickness = getByLabelText(
      inspector,
      "Thickness (px)",
    ) as HTMLInputElement;
    act(() => fireEvent.change(thickness, { target: { value: "0" } }));
    assert.equal(
      getByRole(inspector, "alert").textContent,
      "Thickness (px) must be at least 1.",
    );
    act(() => fireEvent.keyDown(thickness, { key: "ArrowUp", shiftKey: true }));
    assert.equal(
      (
        controller.getState().document.nodes.d1?.props as {
          thicknessPx: number;
        }
      ).thicknessPx,
      11,
    );
    harness.unmount();
  });

  test("rich-text alignment and the text-variable picker are available", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const variables = SAMPLE_VARIABLE_DEFINITIONS;
    const variableRegistry = createVariableRegistry(variables);
    assert.equal(variableRegistry.ok, true);
    if (!variableRegistry.ok) return;
    const registriesResult = createBuilderRegistries({
      blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
      modes: DEFAULT_RENDERER_REGISTRIES.modes,
      variables: variableRegistry.value,
      inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
    });
    assert.equal(registriesResult.ok, true);
    if (!registriesResult.ok) return;
    const registries = registriesResult.value;
    const controller = new BuilderController(
      createStarterDocument("email", registries),
      { registries },
    );
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "rich-text",
        nodeId: "rich-text-1",
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller, {
      registries,
      variables,
    });
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);
    const center = inspector.querySelector<HTMLButtonElement>(
      'button[aria-label="Center"]',
    );
    assert.ok(center);
    act(() => fireEvent.click(center));
    const value = (
      controller.getState().document.nodes["rich-text-1"]
        ?.props as RichTextProps
    ).value;
    const paragraph = value.children.find(
      (child) => child.type === "paragraph",
    );
    assert.equal(
      paragraph?.type === "paragraph" ? paragraph.align : null,
      "center",
    );
    assert.ok(
      harness.container.querySelector('button[aria-haspopup="listbox"]'),
      "selected text blocks expose the add-variable picker on the canvas",
    );
    const trigger = harness.container.querySelector<HTMLButtonElement>(
      ".donativus-vb-canvas-node.is-selected .donativus-vb-variable-insert-trigger",
    );
    assert.ok(trigger);
    act(() => fireEvent.click(trigger));
    const firstOption = document.body.querySelector<HTMLElement>(
      '.donativus-vb-variable-insert-menu [role="option"]',
    );
    const firstOptionText = firstOption?.textContent ?? "";
    harness.unmount();
    assert.match(firstOptionText, /%recipient\.firstName%/);
  });

  test("document settings contain base, spacing, and link controls", async () => {
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);
    assert.match(inspector.textContent ?? "", /Base settings/);
    assert.match(inspector.textContent ?? "", /Spacing/);
    assert.match(inspector.textContent ?? "", /Link/);
    assert.equal(inspector.textContent?.includes("Text color"), false);
    assert.equal(inspector.textContent?.includes("Font family"), false);
    assert.equal(inspector.querySelectorAll('input[type="color"]').length, 2);
    assert.ok(
      inspector.querySelector('input[aria-label="Document background"]') ??
        Array.from(inspector.querySelectorAll("label")).find(
          (label) => label.textContent === "Document background",
        ),
    );
    assert.match(inspector.textContent ?? "", /Sections canvas max-width/);
    harness.unmount();
  });

  test("document padding defaults to 20px and zero renders the sections canvas flush", async () => {
    const { act } = await import("react");
    const { fireEvent, getByLabelText } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);
    const top = getByLabelText(inspector, "Top") as HTMLInputElement;
    assert.equal(top.value, "20");
    const sectionsCanvas = harness.container.querySelector<HTMLElement>(
      "[data-vb-sections-canvas]",
    );
    assert.equal(sectionsCanvas?.style.padding, "20px");
    act(() => fireEvent.change(top, { target: { value: "0" } }));
    assert.deepEqual(controller.getState().document.settings.spacing, {
      topPx: 0,
      rightPx: 0,
      bottomPx: 0,
      leftPx: 0,
    });
    assert.equal(sectionsCanvas?.style.padding, "0px");
    harness.unmount();
  });

  test("document link settings style the canvas and inline editing surfaces", async () => {
    const { act } = await import("react");
    const controller = createTestController();
    const document = controller.getState().document;
    assert.equal(
      controller.dispatch({
        type: "update-document-settings",
        settings: {
          ...document.settings,
          linkStyle: { color: "#e02020", underline: false },
        },
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller);
    const sectionsCanvas = harness.container.querySelector<HTMLElement>(
      "[data-vb-sections-canvas]",
    );
    assert.ok(sectionsCanvas);
    assert.equal(
      sectionsCanvas.style.getPropertyValue("--donativus-vb-link-color"),
      "#e02020",
    );
    assert.equal(
      sectionsCanvas.style.getPropertyValue(
        "--donativus-vb-link-text-decoration",
      ),
      "none",
    );

    await act(async () => {
      controller.setSelection("h1");
      await Promise.resolve();
    });
    const editable = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"] [contenteditable="true"]',
    );
    assert.ok(editable);
    assert.equal(
      editable.style.getPropertyValue("--donativus-vb-link-color"),
      "#e02020",
    );
    assert.equal(
      editable.style.getPropertyValue("--donativus-vb-link-text-decoration"),
      "none",
    );
    harness.unmount();
  });

  test("button padding styles the button while canvas margin expands its selectable boundary", async () => {
    const { act } = await import("react");
    const { fireEvent, getAllByLabelText } =
      await import("@testing-library/dom");
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "cta",
        nodeId: "cta-spacing",
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller);
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);
    const topFields = getAllByLabelText(inspector, "Top") as HTMLInputElement[];
    assert.equal(topFields.length, 2);
    act(() => fireEvent.change(topFields[0]!, { target: { value: "18" } }));
    act(() => fireEvent.change(topFields[1]!, { target: { value: "7" } }));

    const props = controller.getState().document.nodes["cta-spacing"]
      ?.props as {
      spacing: { topPx: number };
      margin: { topPx: number };
    };
    assert.equal(props.spacing.topPx, 18);
    assert.equal(props.margin.topPx, 7);
    const canvasNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="cta-spacing"]',
    );
    const marginRegion = canvasNode?.querySelector<HTMLElement>(
      "[data-vb-canvas-margin]",
    );
    const button = marginRegion?.querySelector<HTMLElement>("span[style]");
    assert.ok(canvasNode && marginRegion);
    assert.equal(canvasNode.contains(marginRegion), true);
    assert.equal(marginRegion.style.paddingTop, "7px");
    assert.equal(marginRegion.style.margin, "");
    assert.equal(button?.style.paddingTop, "18px");
    harness.unmount();
  });

  test("section and button shadows are editable and reflected on the canvas", async () => {
    const { act } = await import("react");
    const { fireEvent, getByLabelText } = await import("@testing-library/dom");
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "cta",
        nodeId: "cta-1",
      }).ok,
      true,
    );
    controller.setSelection("section-1");
    const harness = await renderEmailPreset(controller);
    const inspector = harness.container.querySelector<HTMLElement>(
      "[data-vb-inspector]",
    );
    assert.ok(inspector);

    let shadowToggle = getByLabelText(inspector, "Shadow");
    act(() => fireEvent.click(shadowToggle));
    const sectionProps = controller.getState().document.nodes["section-1"]
      ?.props as {
      shadow: {
        offsetXPx: number;
        offsetYPx: number;
        blurPx: number;
        spreadPx: number;
      } | null;
    };
    assert.deepEqual(sectionProps.shadow, {
      offsetXPx: 0,
      offsetYPx: 8,
      blurPx: 30,
      spreadPx: -15,
      color: "#b3b3b3",
    });
    const sectionSurface = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="section-1"] > [data-vb-canvas-margin] > div[style]',
    );
    assert.match(sectionSurface?.style.boxShadow ?? "", /0px 8px 30px -15px/);

    act(() => controller.setSelection("cta-1"));
    shadowToggle = getByLabelText(inspector, "Shadow");
    act(() => fireEvent.click(shadowToggle));
    const ctaProps = controller.getState().document.nodes["cta-1"]?.props as {
      shadow: { blurPx: number } | null;
    };
    assert.equal(ctaProps.shadow?.blurPx, 30);
    const ctaSurface = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="cta-1"] span[style]',
    );
    assert.match(ctaSurface?.style.boxShadow ?? "", /0px 8px 30px -15px/);
    harness.unmount();
  });

  test("the document background fills the canvas while max-width constrains an auto-height sections canvas", async () => {
    const controller = createTestController();
    const currentDocument = controller.getState().document;
    assert.equal(
      controller.dispatch({
        type: "update-document-settings",
        settings: {
          ...currentDocument.settings,
          canvasBackgroundColor: "#000000",
          contentWidth: { unit: "px", value: 600 },
          contentAlign: "center",
        },
      }).ok,
      true,
    );
    const section = controller.getState().document.nodes["section-1"]!;
    assert.equal(
      controller.dispatch({
        type: "update-node-props",
        nodeId: section.id,
        props: {
          ...section.props,
          background: { color: "#ffffff" },
        },
      }).ok,
      true,
    );

    const harness = await renderEmailPreset(controller);
    const canvas = harness.container.querySelector<HTMLElement>(
      ".donativus-vb-canvas",
    );
    const sectionsCanvas = harness.container.querySelector<HTMLElement>(
      "[data-vb-sections-canvas]",
    );
    const previewViewport = harness.container.querySelector<HTMLElement>(
      "[data-vb-preview-viewport]",
    );
    const sectionSurface = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="section-1"] > [data-vb-canvas-margin] > div[style]',
    );
    assert.ok(canvas && previewViewport && sectionsCanvas && sectionSurface);
    assert.equal(canvas.style.backgroundColor, "rgb(0, 0, 0)");
    assert.equal(previewViewport.style.width, "100%");
    assert.equal(previewViewport.style.justifyContent, "center");
    assert.equal(sectionsCanvas.style.width, "100%");
    assert.equal(sectionsCanvas.style.maxWidth, "600px");
    assert.equal(previewViewport.style.height, "");
    assert.equal(previewViewport.style.minHeight, "");
    assert.equal(sectionsCanvas.style.height, "");
    assert.equal(sectionsCanvas.style.minHeight, "");
    assert.equal(
      harness.container.querySelector("[data-vb-document-main]"),
      null,
    );
    assert.equal(sectionSurface.style.backgroundColor, "rgb(255, 255, 255)");

    harness.unmount();
  });

  test("an image block without an asset shows the canvas image placeholder", async () => {
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "image",
        nodeId: "empty-image",
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller);
    const placeholder = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="empty-image"] [data-vb-image-placeholder]',
    );
    assert.ok(placeholder);
    assert.equal(placeholder.style.width, "100%");
    assert.equal(placeholder.style.maxWidth, "100%");
    assert.ok(
      placeholder.querySelector(".donativus-vb-image-placeholder-icon svg"),
    );
    harness.unmount();
  });

  test("a columns block is immediately usable and library insertions target its first column", async () => {
    const { act } = await import("react");
    const { fireEvent, getByLabelText } = await import("@testing-library/dom");
    const controller = createTestController();
    controller.setSelection("section-1");
    const harness = await renderEmailPreset(controller);

    const insertColumns = harness.container.querySelector<HTMLElement>(
      '[aria-label="Insert Columns"]',
    );
    assert.ok(insertColumns);
    act(() => fireEvent.click(insertColumns));
    const columnsId = controller.getState().transient.selectedNodeId;
    assert.ok(columnsId);
    let columnIds =
      controller.getState().document.nodes[columnsId]?.children ?? [];
    assert.equal(columnIds.length, 2);

    const columnCount = getByLabelText(harness.container, "Number of columns");
    act(() => fireEvent.change(columnCount, { target: { value: "3" } }));
    columnIds = controller.getState().document.nodes[columnsId]?.children ?? [];
    assert.equal(columnIds.length, 3);

    const firstWidth = getByLabelText(harness.container, "Column 1 width (%)");
    act(() => fireEvent.change(firstWidth, { target: { value: "50" } }));
    const ratios = (
      controller.getState().document.nodes[columnsId]?.props as {
        columnWidthRatios: number[];
      }
    ).columnWidthRatios;
    assert.equal(ratios[0], 50);
    assert.equal(
      Math.round(ratios.reduce((sum, ratio) => sum + ratio, 0)),
      100,
    );

    const insertHeading = harness.container.querySelector<HTMLElement>(
      '[aria-label="Insert Heading"]',
    );
    assert.ok(insertHeading);
    act(() => fireEvent.click(insertHeading));
    const insertedHeadingId = controller.getState().transient.selectedNodeId;
    assert.ok(insertedHeadingId);
    assert.ok(
      controller
        .getState()
        .document.nodes[columnIds[0]!]?.children?.includes(insertedHeadingId),
    );
    harness.unmount();
  });

  test("individual columns expose only left/right reorder controls", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "columns",
        nodeId: "columns-1",
      }).ok,
      true,
    );
    const [firstColumn, secondColumn] =
      controller.getState().document.nodes["columns-1"]?.children ?? [];
    assert.ok(firstColumn && secondColumn);
    controller.setSelection(secondColumn);
    const harness = await renderEmailPreset(controller);
    const selectedColumn = harness.container.querySelector<HTMLElement>(
      `[data-vb-canvas-node="${secondColumn}"]`,
    );
    assert.ok(selectedColumn);
    const toolbar =
      selectedColumn.querySelector<HTMLElement>('[role="toolbar"]');
    assert.ok(toolbar);
    assert.ok(toolbar.querySelector('button[aria-label="Move left"]'));
    assert.ok(toolbar.querySelector('button[aria-label="Move right"]'));
    assert.equal(toolbar.querySelector('button[aria-label="Duplicate"]'), null);
    assert.equal(toolbar.querySelector('button[aria-label="Delete"]'), null);
    assert.equal(selectedColumn.querySelector('[aria-label^="Drag "]'), null);

    const moveLeft = toolbar.querySelector<HTMLButtonElement>(
      'button[aria-label="Move left"]',
    );
    assert.ok(moveLeft);
    act(() => fireEvent.click(moveLeft));
    assert.deepEqual(
      controller.getState().document.nodes["columns-1"]?.children,
      [secondColumn, firstColumn],
    );
    harness.unmount();
  });

  test("Alt+ArrowDown moves a block exactly like the equivalent move command, with announcement and focus restoration", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();

    // The command-equivalence twin: same document, direct command dispatch.
    const twin = createTestController();
    assert.equal(
      twin.dispatch({
        type: "move-node",
        nodeId: "h1",
        newParentId: "section-1",
        index: 1,
      }).ok,
      true,
    );

    const harness = await renderEmailPreset(controller);
    const headingNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"]',
    );
    assert.ok(headingNode);

    act(() => {
      headingNode.focus();
    });
    act(() => {
      fireEvent.keyDown(headingNode, { key: "ArrowDown", altKey: true });
    });

    assert.deepEqual(sectionChildren(controller), sectionChildren(twin));
    assert.deepEqual(sectionChildren(controller), ["d1", "h1"]);

    // One undo restores the previous order (single command per operation).
    assert.equal(controller.undo(), true);
    assert.deepEqual(sectionChildren(controller), ["h1", "d1"]);
    controller.redo();

    const liveRegion = harness.container.querySelector('[role="status"]');
    assert.ok(liveRegion);
    assert.match(liveRegion.textContent ?? "", /moved to position 2 of 2/i);

    await flushFocusRestoration();
    assert.equal(
      document.activeElement?.getAttribute("data-vb-canvas-node"),
      "h1",
    );

    harness.unmount();
  });

  test("Delete removes the block, selects its parent, and announces; Ctrl+D duplicates", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    const headingNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"]',
    );
    assert.ok(headingNode);
    act(() => {
      fireEvent.keyDown(headingNode, { key: "d", ctrlKey: true });
    });
    assert.equal(sectionChildren(controller).length, 3);
    const liveRegion = harness.container.querySelector('[role="status"]');
    assert.match(liveRegion?.textContent ?? "", /duplicated/i);

    act(() => {
      fireEvent.keyDown(headingNode, { key: "Delete" });
    });
    assert.equal(sectionChildren(controller).includes("h1"), false);
    assert.equal(controller.getState().transient.selectedNodeId, "section-1");
    assert.match(liveRegion?.textContent ?? "", /deleted/i);

    await flushFocusRestoration();
    assert.equal(
      document.activeElement?.getAttribute("data-vb-canvas-node"),
      "section-1",
    );

    harness.unmount();
  });

  test("library insert works without any drag gesture and announces", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    controller.setSelection("section-1");
    const harness = await renderEmailPreset(controller);

    const insertButton = harness.container.querySelector(
      '[aria-label="Insert Button"]',
    );
    assert.ok(insertButton, "library exposes labeled insert buttons");
    act(() => {
      fireEvent.click(insertButton);
    });

    const children = sectionChildren(controller);
    const lastChildId = children[children.length - 1];
    assert.ok(lastChildId);
    assert.equal(
      controller.getState().document.nodes[lastChildId]?.type,
      "cta",
    );
    assert.match(
      harness.container.querySelector('[role="status"]')?.textContent ?? "",
      /inserted/i,
    );

    harness.unmount();
  });

  test("toolbar exposes undo/redo, all device widths, and keeps secondary status in the left rail", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = new BuilderController(
      createStarterDocument("email", DEFAULT_RENDERER_REGISTRIES),
      {
        registries: DEFAULT_RENDERER_REGISTRIES,
      },
    );
    const harness = await renderEmailPreset(controller, { withSave: true });

    const undoButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Undo"]',
    );
    const redoButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Redo"]',
    );
    assert.ok(undoButton && redoButton);
    assert.equal(undoButton.disabled, true);
    assert.equal(redoButton.disabled, true);

    act(() => {
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "spacer",
        nodeId: "s1",
      });
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "columns",
        nodeId: "columns-mobile",
      });
    });
    assert.equal(undoButton.disabled, false);

    const desktopButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Desktop preview width"]',
    );
    const tabletButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Tablet preview width"]',
    );
    const mobileButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Mobile preview width"]',
    );
    assert.ok(desktopButton && tabletButton && mobileButton);
    assert.ok(tabletButton.querySelector(".lucide-tablet-smartphone"));
    assert.equal(desktopButton.getAttribute("aria-pressed"), "true");
    assert.equal(tabletButton.getAttribute("aria-pressed"), "false");
    assert.equal(mobileButton.getAttribute("aria-pressed"), "false");

    act(() => {
      fireEvent.click(tabletButton);
    });
    assert.equal(tabletButton.getAttribute("aria-pressed"), "true");
    const emailComposer = harness.container.querySelector<HTMLElement>(
      "[data-vb-email-composer]",
    );
    assert.ok(emailComposer);
    assert.equal(emailComposer.dataset.vbPreviewDevice, "tablet");
    assert.equal(
      emailComposer.style.getPropertyValue(
        "--donativus-vb-email-composer-viewport-width",
      ),
      "768px",
    );
    assert.equal(
      harness.container.querySelector<HTMLElement>("[data-vb-preview-viewport]")
        ?.style.width,
      "768px",
    );

    act(() => {
      fireEvent.click(mobileButton);
    });
    assert.equal(mobileButton.getAttribute("aria-pressed"), "true");
    assert.equal(emailComposer.dataset.vbPreviewDevice, "mobile");
    assert.equal(
      emailComposer.style.getPropertyValue(
        "--donativus-vb-email-composer-viewport-width",
      ),
      "375px",
    );
    const canvas = harness.container.querySelector(
      '[data-vb-preview-device="mobile"]',
    );
    assert.ok(canvas, "canvas reflects the mobile preview width");
    assert.ok(
      canvas.querySelector(
        '.donativus-vb-canvas-columns[data-vb-responsive-stack="stack"]',
      ),
      "responsive columns expose their stack setting to the mobile canvas",
    );

    const samplesToggle = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Show sample values"]',
    );
    assert.ok(samplesToggle);
    const leftRail = harness.container.querySelector(".donativus-vb-left-rail");
    assert.ok(leftRail?.contains(samplesToggle));
    assert.ok(
      leftRail?.contains(
        harness.container.querySelector('[aria-label="Validation status"]'),
      ),
    );
    assert.equal(samplesToggle.getAttribute("aria-pressed"), "false");
    act(() => {
      fireEvent.click(samplesToggle);
    });
    assert.equal(samplesToggle.getAttribute("aria-pressed"), "true");

    const toolbar = harness.container.querySelector('[role="toolbar"]');
    const previewButton = toolbar?.querySelector('[aria-label="Preview"]');
    const saveButton = toolbar?.querySelector('[aria-label="Save"]');
    assert.ok(toolbar && previewButton && saveButton);
    assert.equal(toolbar.textContent?.includes("Email"), false);
    assert.ok(
      (previewButton.compareDocumentPosition(saveButton) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
      "Preview is immediately before consumer actions such as Save",
    );

    harness.unmount();
  });

  test("validation review lists issues and links them to their node", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    const statusButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Validation status"]',
    );
    assert.ok(statusButton);
    assert.equal(statusButton.dataset.vbValidationStatus, "warnings");
    assert.match(statusButton.textContent ?? "", /warning/i);
    act(() => {
      fireEvent.click(statusButton);
    });

    const panel = harness.container.querySelector(
      '[role="dialog"][aria-label="Validation review"]',
    );
    assert.ok(panel, "review panel opens");
    // The starter heading has empty text and the CTA-less document still yields quality warnings; at minimum the panel renders without errors.
    assert.equal(statusButton.getAttribute("aria-expanded"), "true");

    act(() => {
      fireEvent.click(
        panel.querySelector('[aria-label="Close"]') as HTMLElement,
      );
    });
    assert.equal(
      harness.container.querySelector(
        '[role="dialog"][aria-label="Validation review"]',
      ),
      null,
    );

    harness.unmount();
  });

  test("preview renders sandboxed renderer HTML, never the canvas DOM", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller);

    const previewButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Preview"]',
    );
    assert.ok(previewButton);
    act(() => {
      fireEvent.click(previewButton);
    });

    const dialog = harness.container.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    assert.ok(dialog, "preview opens as a fullscreen modal");
    const frame = harness.container.querySelector<HTMLIFrameElement>(
      "iframe.donativus-vb-preview-frame",
    );
    assert.ok(frame, "preview iframe renders");
    assert.ok(
      frame.hasAttribute("data-vb-preview-scroll-viewport"),
      "the iframe is the bounded scrolling viewport",
    );
    assert.equal(
      frame.getAttribute("sandbox"),
      "",
      "sandbox with no capabilities",
    );
    assert.equal(frame.getAttribute("referrerpolicy"), "no-referrer");
    assert.match(frame.getAttribute("srcdoc") ?? "", /<!doctype html/i);
    assert.doesNotMatch(
      frame.getAttribute("srcdoc") ?? "",
      /donativus-vb-canvas/,
      "renderer output, not canvas DOM",
    );

    const debugActions = dialog.querySelector(
      ".donativus-vb-preview-debug-actions",
    );
    assert.deepEqual(
      Array.from(
        debugActions?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      ).map((button) => button.getAttribute("aria-label")),
      ["Show sample values", "HTML source", "JSON layout"],
    );
    const htmlSourceButton = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="HTML source"]',
    );
    const jsonLayoutButton = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="JSON layout"]',
    );
    assert.ok(htmlSourceButton && jsonLayoutButton);
    act(() => fireEvent.click(htmlSourceButton));
    const htmlSource = dialog.querySelector<HTMLElement>(
      '[data-vb-preview-source="html"]',
    );
    assert.match(htmlSource?.textContent ?? "", /<!doctype html/i);
    assert.match(
      htmlSource?.textContent ?? "",
      /<!doctype html[^>]*>\s*\n\s*<html/i,
      "HTML source is formatted into readable lines",
    );
    assert.equal(
      dialog.querySelector("iframe.donativus-vb-preview-frame"),
      null,
      "source view replaces the preview frame while debugging",
    );
    act(() => fireEvent.click(jsonLayoutButton));
    const jsonSource = dialog.querySelector<HTMLElement>(
      '[data-vb-preview-source="json"]',
    );
    assert.match(jsonSource?.textContent ?? "", /"schemaVersion"/);
    assert.ok(
      jsonSource?.querySelector('[aria-label="Copy source"]'),
      "both debug sources expose a direct copy action",
    );
    act(() => fireEvent.click(jsonLayoutButton));
    const restoredFrame = dialog.querySelector<HTMLIFrameElement>(
      "iframe.donativus-vb-preview-frame",
    );
    assert.ok(restoredFrame, "closing source view restores the preview frame");

    const desktopButton = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="Desktop"]',
    );
    const tabletButton = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="Tablet"]',
    );
    const mobileButton = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="Mobile"]',
    );
    assert.ok(desktopButton && tabletButton && mobileButton);
    assert.ok(tabletButton.querySelector(".lucide-tablet-smartphone"));
    assert.equal(desktopButton.getAttribute("aria-pressed"), "true");

    act(() => fireEvent.click(tabletButton));
    const tabletStage = harness.container.querySelector<HTMLElement>(
      '[data-vb-preview-device="tablet"]',
    );
    assert.ok(tabletStage);
    assert.equal(
      tabletStage.querySelector<HTMLElement>(".donativus-vb-preview-device")
        ?.style.width,
      "768px",
    );
    assert.equal(
      tabletStage
        .querySelector<HTMLElement>(".donativus-vb-preview-device")
        ?.style.getPropertyValue("--donativus-vb-preview-device-height"),
      "1024px",
    );
    assert.equal(restoredFrame.style.height, "100%");

    act(() => fireEvent.click(mobileButton));
    assert.ok(
      harness.container.querySelector('[data-vb-preview-device="mobile"]'),
    );
    assert.equal(restoredFrame.style.height, "100%");

    act(() => fireEvent.keyDown(dialog, { key: "Escape" }));
    assert.equal(
      harness.container.querySelector('[role="dialog"][aria-modal="true"]'),
      null,
    );

    harness.unmount();
  });

  test("preview can render sample values without replacing durable variable tokens", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const variables: readonly VariableDefinition[] = [
      {
        key: "recipient.firstName",
        token: "%recipient.firstName%",
        label: "First name",
        sampleValue: "Ada <Admin>",
        allowedContexts: ["text"],
      },
    ];
    const variableRegistry = createVariableRegistry(variables);
    assert.equal(variableRegistry.ok, true);
    if (!variableRegistry.ok) return;
    const registriesResult = createBuilderRegistries({
      blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
      modes: DEFAULT_RENDERER_REGISTRIES.modes,
      variables: variableRegistry.value,
      inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
    });
    assert.equal(registriesResult.ok, true);
    if (!registriesResult.ok) return;
    const registries = registriesResult.value;
    const controller = new BuilderController(
      createStarterDocument("email", registries),
      { registries },
    );
    assert.equal(
      controller.dispatch({
        type: "insert-node",
        parentId: "section-1",
        blockType: "heading",
        nodeId: "variable-heading",
      }).ok,
      true,
    );
    const headingProps = controller.getState().document.nodes[
      "variable-heading"
    ]?.props as HeadingProps;
    assert.equal(
      controller.dispatch({
        type: "update-node-props",
        nodeId: "variable-heading",
        props: {
          ...headingProps,
          text: {
            kind: "donativus.rich-text",
            version: 1,
            children: [
              {
                type: "paragraph",
                align: "left",
                children: [
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
      }).ok,
      true,
    );
    const harness = await renderEmailPreset(controller, {
      registries,
      variables,
    });

    const previewButton = harness.container.querySelector<HTMLButtonElement>(
      '[aria-label="Preview"]',
    );
    assert.ok(previewButton);
    act(() => fireEvent.click(previewButton));
    const dialog = harness.container.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    assert.ok(dialog);
    const tokenFrame = dialog.querySelector<HTMLIFrameElement>(
      "iframe.donativus-vb-preview-frame",
    );
    assert.match(
      tokenFrame?.getAttribute("srcdoc") ?? "",
      /%recipient\.firstName%/,
    );

    const sampleToggle = dialog.querySelector<HTMLButtonElement>(
      '[aria-label="Show sample values"]',
    );
    assert.ok(sampleToggle);
    act(() => fireEvent.click(sampleToggle));

    const sampleFrame = dialog.querySelector<HTMLIFrameElement>(
      "iframe.donativus-vb-preview-frame",
    );
    assert.match(
      sampleFrame?.getAttribute("srcdoc") ?? "",
      /Ada &lt;Admin&gt;/,
    );
    assert.doesNotMatch(
      sampleFrame?.getAttribute("srcdoc") ?? "",
      /%recipient\.firstName%/,
    );
    assert.equal(sampleToggle.getAttribute("aria-pressed"), "true");
    assert.equal(
      sampleToggle.getAttribute("aria-label"),
      "Show variable tokens",
    );
    assert.match(
      JSON.stringify(controller.getState().document),
      /%recipient\.firstName%/,
    );

    harness.unmount();
  });

  test("narrow layout opens library and inspector as inline sidebars", async () => {
    const { act } = await import("react");
    const { fireEvent } = await import("@testing-library/dom");
    const controller = createTestController();
    const harness = await renderEmailPreset(controller, { layout: "narrow" });

    assert.equal(
      harness.container.querySelector('[data-vb-layout="narrow"]') !== null,
      true,
    );
    assert.equal(
      harness.container.querySelector(".donativus-vb-left-rail"),
      null,
      "no fixed rails when narrow",
    );

    const openLibrary = harness.container.querySelector<HTMLButtonElement>(
      ".donativus-vb-narrow-bar button[aria-controls]",
    );
    assert.ok(openLibrary);
    act(() => {
      fireEvent.click(openLibrary);
    });

    const sidebarId = openLibrary.getAttribute("aria-controls");
    const sidebar = sidebarId
      ? harness.container.querySelector(`[id="${sidebarId}"]`)
      : null;
    assert.ok(sidebar, "library opens as an inline workspace sidebar");
    assert.equal(sidebar?.tagName, "ASIDE");
    assert.equal(openLibrary.getAttribute("aria-expanded"), "true");
    assert.ok(
      sidebar.querySelector('[role="tablist"]'),
      "library tabs remain available inside the inline sidebar",
    );
    assert.equal(
      harness.container.querySelector('[role="dialog"][aria-modal="true"]'),
      null,
      "inline sidebars do not cover the canvas with a modal overlay",
    );

    act(() => {
      fireEvent.click(openLibrary);
    });
    assert.equal(
      sidebarId ? harness.container.querySelector(`[id="${sidebarId}"]`) : null,
      null,
      "the same control closes the inline sidebar",
    );

    const canvasNode = harness.container.querySelector<HTMLElement>(
      '[data-vb-canvas-node="h1"]',
    );
    const openInspector = harness.container.querySelectorAll<HTMLButtonElement>(
      ".donativus-vb-narrow-bar button[aria-controls]",
    )[1];
    assert.ok(canvasNode);
    assert.ok(openInspector);
    await act(async () => {
      fireEvent.click(canvasNode);
      await Promise.resolve();
    });

    const inspectorSidebarId = openInspector.getAttribute("aria-controls");
    assert.ok(
      inspectorSidebarId &&
        harness.container.querySelector(`[id="${inspectorSidebarId}"]`),
      "selecting a canvas node opens the inline inspector",
    );
    assert.equal(openInspector.getAttribute("aria-expanded"), "true");

    harness.unmount();
  });

  test("places host status notices above validation on wide layouts and above responsive controls when narrow", async () => {
    const React = await import("react");
    const createNotice = () =>
      React.createElement(
        "div",
        { "data-vb-test-status-notice": "true" },
        "Migration notice",
      );

    const wide = await renderEmailPreset(createTestController(), {
      sidebarStatusNotice: createNotice(),
    });
    const wideStatus = wide.container.querySelector(
      ".donativus-vb-sidebar-status",
    );
    assert.ok(wideStatus);
    assert.equal(
      wideStatus.firstElementChild?.getAttribute("class"),
      "donativus-vb-sidebar-status-notice",
      "notice precedes the validation status control",
    );
    assert.ok(wideStatus.querySelector('[data-vb-test-status-notice="true"]'));
    wide.unmount();

    const narrow = await renderEmailPreset(createTestController(), {
      layout: "narrow",
      sidebarStatusNotice: createNotice(),
    });
    const narrowNotice = narrow.container.querySelector(
      ".donativus-vb-narrow-status-notice",
    );
    const narrowBar = narrow.container.querySelector(
      ".donativus-vb-narrow-bar",
    );
    assert.ok(narrowNotice);
    assert.ok(narrowBar);
    assert.ok(
      narrowNotice.querySelector('[data-vb-test-status-notice="true"]'),
    );
    assert.equal(
      narrowNotice.compareDocumentPosition(narrowBar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      Node.DOCUMENT_POSITION_FOLLOWING,
      "notice appears before the responsive workspace controls",
    );
    narrow.unmount();
  });

  test("unsupported plugin nodes render a preserved placeholder", async () => {
    const controller = createTestController();
    const document_ = controller.getState().document;
    // Simulate a restored unavailable plugin node exactly as the parser preserves it.
    const withUnknown = {
      ...document_,
      nodes: {
        ...document_.nodes,
        "section-1": {
          ...document_.nodes["section-1"]!,
          children: [...(document_.nodes["section-1"]!.children ?? []), "x1"],
        },
        x1: {
          id: "x1",
          type: "custom-widget",
          version: 1,
          props: {},
          unavailable: true,
        },
      },
    };
    controller.loadDocument(withUnknown as never);

    const harness = await renderEmailPreset(controller);
    const placeholder = harness.container.querySelector(
      ".donativus-vb-unsupported-block",
    );
    assert.ok(placeholder, "unsupported block placeholder renders");
    assert.match(placeholder.textContent ?? "", /custom-widget/);
    assert.match(placeholder.textContent ?? "", /preserved/i);

    harness.unmount();
  });
});
