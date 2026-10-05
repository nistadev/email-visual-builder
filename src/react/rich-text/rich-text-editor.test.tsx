import assert from "node:assert/strict";
import test from "node:test";
import type { RichTextValue, VariableDefinition } from "../../types/index.js";
import type { LexicalEditor } from "lexical";
import {
  installJsdomGlobals,
  pollUntil,
  type JsdomHandle,
} from "../../test-utils/index.js";
import { createVariableRegistry } from "../../core/registry/variable-registry.js";
import type { VariableRegistry } from "../../core/registry/types.js";

// Every React/Lexical-DOM-dependent module is imported dynamically, inside the test body,
// after `installJsdomGlobals()` has run — several of those modules cache environment
// references (e.g. `document`) at import time, so importing them before jsdom is installed
// silently breaks DOM-dependent behavior (confirmed empirically: `clearFormatting`, which
// reads `$getSelection()` synchronously, only worked correctly under this ordering). This
// mirrors the existing `test-setup.smoke.test.tsx` convention.
//
// Raw keystroke/IME simulation is deliberately not exercised here: jsdom does not implement
// the native `beforeinput`/composition event flow a real contentEditable relies on, and
// `userEvent.keyboard()` against Lexical's contentEditable under jsdom produces no commits at
// all (verified empirically) — a jsdom limitation, not a signal about this adapter. What *is*
// tested here is the layer real keyboard shortcuts and toolbar buttons both call
// (`formatting-commands.ts`) plus the commit/undo/paste pipeline around it; task 17.3 covers
// manual, browser-based keyboard-only and IME verification.

const EMPTY_VALUE: RichTextValue = {
  kind: "donativus.rich-text",
  version: 1,
  children: [
    {
      type: "paragraph",
      align: "left",
      children: [{ type: "text", text: "Hello world", marks: [] }],
    },
  ],
};

const DONATE_URL: VariableDefinition = {
  key: "donate.url",
  token: "%donate.url%",
  label: "Donate link",
  sampleValue: "https://donate.example.org",
  allowedContexts: ["url"],
};

const RECIPIENT_FIRST_NAME: VariableDefinition = {
  key: "recipient.firstName",
  token: "%recipient.firstName%",
  label: "First name",
  sampleValue: "Ada",
  allowedContexts: ["text"],
};

const UNSUBSCRIBE_URL: VariableDefinition = {
  key: "unsubscribe_url",
  token: "%unsubscribe_url%",
  label: "Unsubscribe link",
  sampleValue: "https://example.com/unsubscribe",
  allowedContexts: ["url", "email-system-link"],
};

function requireRegistry(): VariableRegistry {
  const result = createVariableRegistry([
    DONATE_URL,
    RECIPIENT_FIRST_NAME,
    UNSUBSCRIBE_URL,
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

test("RichTextEditor — React interaction (task 11.7)", async (t) => {
  let jsdom: JsdomHandle;
  t.before(() => {
    jsdom = installJsdomGlobals();
  });
  t.after(async () => {
    await jsdom.cleanup();
  });

  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    $nodesOfType,
    $createNodeSelection,
    $setSelection,
    $selectAll,
    PASTE_COMMAND,
    UNDO_COMMAND,
  } = await import("lexical");
  const { RichTextEditor } = await import("./RichTextEditor.js");
  const { clearFormatting, insertUnorderedList, toggleLink, toggleMark } =
    await import("./formatting-commands.js");
  const { $createVariableNode, $isVariableNode, VariableNode } =
    await import("./variable-node.js");
  const { $isInvalidVariableTextNode, InvalidVariableTextNode } =
    await import("./invalid-variable-text-node.js");

  /** Mounts a fresh `RichTextEditor` and returns its live editor + a running list of every `onCommit` value. */
  function mountEditor(
    registry: VariableRegistry,
    options: {
      showVariableInsert?: boolean;
      showFormattingToolbar?: boolean;
    } = {},
  ): {
    editor: LexicalEditor;
    commits: RichTextValue[];
    container: HTMLDivElement;
    resync: (value: RichTextValue, token: number) => Promise<void>;
    unmount: () => void;
  } {
    const editorRef: { current: LexicalEditor | null } = { current: null };
    const commits: RichTextValue[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const render = (initialValue: RichTextValue, resyncToken?: number) => {
      root.render(
        React.createElement(RichTextEditor, {
          initialValue,
          registry,
          variables: [DONATE_URL, RECIPIENT_FIRST_NAME, UNSUBSCRIBE_URL],
          onCommit: (value: RichTextValue) => commits.push(value),
          editorRef,
          placeholder: "Write something…",
          ariaLabel: "Body",
          resyncToken,
          showVariableInsert: options.showVariableInsert,
          variableButtonLabel: "+ Add variable",
          showFormattingToolbar: options.showFormattingToolbar,
          formattingLabels: options.showFormattingToolbar
            ? {
                addVariable: "+ Add variable",
                searchVariables: "Search variables…",
                noVariableMatches: "No variables match your search.",
                addLink: "Add link",
                applyLink: "Apply",
                removeLink: "Remove link",
                fieldDestination: "Destination",
                formatBold: "Bold",
                formatItalic: "Italic",
                formatUnderline: "Underline",
                formatStrikethrough: "Strikethrough",
                formatTextColor: "Text color",
                formatFontFamily: "Font",
                formatFontDefault: "Block font",
                formatClear: "Clear formatting",
                fontGroupSansSerif: "Sans-serif",
                fontGroupSerif: "Serif",
                fontGroupMonospace: "Monospace",
                fontGroupScript: "Script and handwriting",
              }
            : undefined,
        }),
      );
    };
    act(() => {
      render(EMPTY_VALUE);
    });

    const editor = editorRef.current;
    assert.ok(editor, "expected editorRef to be populated after mount");
    return {
      editor: editor as LexicalEditor,
      commits,
      container,
      resync: async (value, token) => {
        await act(async () => {
          render(value, token);
          await Promise.resolve();
        });
      },
      unmount: () => {
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  await t.test(
    "the add-variable picker inserts only variables allowed in text",
    async () => {
      const { fireEvent } = await import("@testing-library/dom");
      const { commits, container, unmount } = mountEditor(requireRegistry(), {
        showVariableInsert: true,
      });
      try {
        const trigger = container.querySelector<HTMLButtonElement>(
          'button[aria-haspopup="listbox"]',
        );
        assert.ok(trigger);
        assert.equal(
          trigger.classList.contains("donativus-vb-variable-insert-trigger"),
          true,
        );
        assert.equal(trigger.textContent?.trim(), "Add variable");
        await act(async () => fireEvent.click(trigger));
        // The dropdown is portaled to `document.body` (see variable-token-menu.tsx)
        // rather than nested under `container`, so it escapes any ancestor
        // scroll/clip container instead of fighting mouse-wheel scroll with it.
        assert.equal(document.body.textContent?.includes("Donate link"), false);
        const option = Array.from(
          document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'),
        ).find((button) => button.textContent?.includes("First name"));
        assert.ok(option);
        await act(async () => {
          fireEvent.click(option);
          await Promise.resolve();
        });
        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph?.type === "paragraph");
        const variable = paragraph.children.find(
          (child) => child.type === "variable",
        );
        assert.ok(variable?.type === "variable");
        assert.equal(variable.variableKey, RECIPIENT_FIRST_NAME.key);
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "bold formatting commits a bold mark, clearFormatting removes it",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => $selectAll());
          toggleMark(editor, "bold");
        });
        const boldParagraph = commits.at(-1)?.children[0];
        assert.ok(
          boldParagraph && boldParagraph.type === "paragraph",
          "expected a committed paragraph after bold toggle",
        );
        assert.ok(
          boldParagraph.children.some(
            (child) => child.type === "text" && child.marks.includes("bold"),
          ),
        );

        commits.length = 0;
        await act(async () => {
          editor.update(() => $selectAll());
          clearFormatting(editor);
        });
        const clearedParagraph = commits.at(-1)?.children[0];
        assert.ok(clearedParagraph && clearedParagraph.type === "paragraph");
        assert.ok(
          clearedParagraph.children.every(
            (child) => child.type !== "text" || child.marks.length === 0,
          ),
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "the selected text toolbar formats text and opens an existing link inspector",
    async () => {
      const { fireEvent } = await import("@testing-library/dom");
      const { editor, commits, unmount } = mountEditor(requireRegistry(), {
        showFormattingToolbar: true,
      });
      try {
        await act(async () => {
          editor.update(() => $selectAll());
        });
        // Each poll tick is its own `act()` call: React only commits state
        // updates when an act() scope closes, so polling from inside one
        // long-running act() call could never observe the toolbar mounting.
        await pollUntil(
          () =>
            document.body.querySelector(
              '[role="toolbar"][aria-label="Text formatting"]',
            ) !== null,
          {
            label: "formatting toolbar to mount",
            tick: () =>
              act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
              }),
          },
        );
        const toolbar = document.body.querySelector<HTMLElement>(
          '[role="toolbar"][aria-label="Text formatting"]',
        );
        assert.ok(toolbar);
        await act(async () => {
          fireEvent.click(toolbar.querySelector('[aria-label="Bold"]')!);
          await Promise.resolve();
        });
        assert.ok(
          commits.at(-1)?.children[0]?.type === "paragraph" &&
            commits
              .at(-1)
              ?.children[0].children.some(
                (child) =>
                  child.type === "text" && child.marks.includes("bold"),
              ),
        );
        await act(async () => {
          fireEvent.click(toolbar.querySelector('[aria-label="Add link"]')!);
          await Promise.resolve();
        });
        await pollUntil(
          () =>
            document.body.querySelector(
              '[role="dialog"][aria-label="Add link"]',
            ) !== null,
          {
            label: "link inspector to open",
            tick: () =>
              act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
              }),
          },
        );
        const linkInspector = document.body.querySelector<HTMLElement>(
          '[role="dialog"][aria-label="Add link"]',
        );
        assert.ok(linkInspector);
        assert.ok(
          linkInspector.querySelector('button[aria-label="+ Add variable"]'),
          "URL variables are available through the compact picker",
        );
        assert.equal(
          Array.from(linkInspector.querySelectorAll("button")).some(
            (button) => button.textContent?.trim() === "Apply",
          ),
          false,
          "the destination saves on Enter or blur instead of requiring Apply",
        );
        // An operator who typed a destination still has focus in the field;
        // the menu's search autofocus must not commit that text and close
        // the inspector before a variable can be picked.
        const destinationInput =
          linkInspector.querySelector<HTMLInputElement>("input")!;
        await act(async () => {
          destinationInput.focus();
          fireEvent.change(destinationInput, {
            target: { value: "unsubscribe" },
          });
          await Promise.resolve();
        });
        await act(async () => {
          fireEvent.click(
            linkInspector.querySelector('button[aria-label="+ Add variable"]')!,
          );
          await Promise.resolve();
        });
        assert.ok(
          document.body.querySelector('[role="dialog"][aria-label="Add link"]'),
          "opening the variable menu keeps the link inspector open",
        );
        const variableMenu = document.body.querySelector<HTMLElement>(
          '[role="listbox"][aria-label="+ Add variable"]',
        );
        assert.ok(variableMenu);
        const unsubscribe = Array.from(
          variableMenu.querySelectorAll<HTMLButtonElement>('[role="option"]'),
        ).find((button) => button.textContent?.includes("Unsubscribe link"));
        assert.ok(unsubscribe);
        await act(async () => {
          fireEvent.click(unsubscribe);
          await Promise.resolve();
        });
        assert.equal(
          document.body.querySelector('[role="dialog"][aria-label="Add link"]'),
          null,
        );
        const updatedParagraph = commits.at(-1)?.children[0];
        assert.ok(updatedParagraph?.type === "paragraph");
        const updatedLink = updatedParagraph.children.find(
          (child) => child.type === "link",
        );
        assert.ok(updatedLink?.type === "link");
        assert.deepEqual(updatedLink.destination.segments, [
          {
            kind: "variable",
            variableKey: UNSUBSCRIBE_URL.key,
            token: UNSUBSCRIBE_URL.token,
          },
        ]);
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "a selection-only change never commits (task 11.6)",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        // Establishing the *first* selection (from none) touches editor state itself, so that
        // baseline change is discarded before asserting on a subsequent, genuinely selection-only move.
        await act(async () => {
          editor.update(() => $selectAll());
        });
        commits.length = 0;
        await act(async () => {
          editor.update(() => $selectAll());
        });
        assert.equal(
          commits.length,
          0,
          "moving the selection alone must not produce a commit",
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "an external resync updates the editor without committing it back",
    async () => {
      const { editor, commits, resync, unmount } =
        mountEditor(requireRegistry());
      try {
        const externalValue: RichTextValue = {
          ...EMPTY_VALUE,
          children: [
            {
              type: "paragraph",
              align: "left",
              children: [
                { type: "text", text: "Changed elsewhere", marks: [] },
              ],
            },
          ],
        };
        await act(async () => {
          await Promise.resolve();
        });
        commits.length = 0;
        await resync(externalValue, 1);

        assert.equal(
          commits.length,
          0,
          "programmatic reloads must not re-enter the controller commit path",
        );
        editor.getEditorState().read(() => {
          assert.equal($getRoot().getTextContent(), "Changed elsewhere");
        });
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "insertUnorderedList converts the current paragraph into a bulleted list",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => $selectAll());
          insertUnorderedList(editor);
        });
        assert.equal(commits.at(-1)?.children[0]?.type, "bulleted-list");
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "toggleLink wraps the selection in a link with the exact destination",
    async () => {
      const { editor, commits, container, unmount } =
        mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => $selectAll());
          toggleLink(editor, "https://example.com/donate");
        });
        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph && paragraph.type === "paragraph");
        const linkChild = paragraph.children.find(
          (child) => child.type === "link",
        );
        assert.ok(linkChild && linkChild.type === "link");
        assert.deepEqual(linkChild.destination, {
          segments: [{ kind: "literal", value: "https://example.com/donate" }],
        });
        assert.ok(
          container.querySelector("a.donativus-vb-rich-text-link"),
          "links use the editor's styled inline-link presentation",
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "a URL variable link commits as a templated destination",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => $selectAll());
          toggleLink(editor, UNSUBSCRIBE_URL.token);
        });
        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph && paragraph.type === "paragraph");
        const linkChild = paragraph.children.find(
          (child) => child.type === "link",
        );
        assert.ok(linkChild && linkChild.type === "link");
        assert.deepEqual(linkChild.destination, {
          segments: [
            {
              kind: "variable",
              variableKey: UNSUBSCRIBE_URL.key,
              token: UNSUBSCRIBE_URL.token,
            },
          ],
        });
      } finally {
        unmount();
      }
    },
  );

  await t.test("bold formatting persists on an atomic variable", async () => {
    const { editor, commits, unmount } = mountEditor(requireRegistry());
    try {
      await act(async () => {
        editor.update(() => {
          const paragraph = $createParagraphNode();
          const variable = $createVariableNode(
            RECIPIENT_FIRST_NAME.key,
            RECIPIENT_FIRST_NAME.token,
            RECIPIENT_FIRST_NAME.label,
            RECIPIENT_FIRST_NAME.sampleValue ?? null,
            true,
          );
          paragraph.append(variable);
          $getRoot().clear().append(paragraph);
          const selection = $createNodeSelection();
          selection.add(variable.getKey());
          $setSelection(selection);
        });
        toggleMark(editor, "bold");
      });
      const paragraph = commits.at(-1)?.children[0];
      assert.ok(paragraph?.type === "paragraph");
      assert.deepEqual(paragraph.children[0], {
        type: "variable",
        variableKey: RECIPIENT_FIRST_NAME.key,
        token: RECIPIENT_FIRST_NAME.token,
        marks: ["bold"],
      });
    } finally {
      unmount();
    }
  });

  await t.test(
    "bold formatting applies to a variable inside a range selection spanning surrounding text",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => {
            const paragraph = $createParagraphNode();
            const before = $createTextNode("Dragă ");
            const variable = $createVariableNode(
              RECIPIENT_FIRST_NAME.key,
              RECIPIENT_FIRST_NAME.token,
              RECIPIENT_FIRST_NAME.label,
              RECIPIENT_FIRST_NAME.sampleValue ?? null,
              true,
            );
            const after = $createTextNode(",");
            paragraph.append(before, variable, after);
            $getRoot().clear().append(paragraph);
          });
          editor.update(() => $selectAll());
          toggleMark(editor, "bold");
        });
        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph?.type === "paragraph");
        const variable = paragraph.children.find(
          (child) => child.type === "variable",
        );
        assert.ok(variable?.type === "variable");
        assert.ok(
          variable.marks?.includes("bold"),
          "expected the variable node caught in the range selection to carry the bold mark",
        );
        assert.ok(
          paragraph.children.some(
            (child) => child.type === "text" && child.marks.includes("bold"),
          ),
          "expected surrounding text to also carry the bold mark",
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "an inserted variable node commits as one atomic segment and cannot carry partial text content",
    async () => {
      const { editor, commits, container, unmount } =
        mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => {
            const paragraph = $createParagraphNode();
            paragraph.append(
              $createVariableNode(
                DONATE_URL.key,
                DONATE_URL.token,
                DONATE_URL.label,
                DONATE_URL.sampleValue ?? null,
                true,
              ),
            );
            $getRoot().clear().append(paragraph);
          });
        });

        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph && paragraph.type === "paragraph");
        const variableSegment = paragraph.children[0];
        assert.equal(variableSegment?.type, "variable");
        assert.equal(
          variableSegment && variableSegment.type === "variable"
            ? variableSegment.token
            : undefined,
          DONATE_URL.token,
        );
        const chip = container.querySelector(".donativus-vb-variable-chip");
        assert.equal(
          chip?.textContent,
          DONATE_URL.token,
          "token preview shows the exact placeholder, not its label",
        );

        editor.getEditorState().read(() => {
          const [variableNode] = $nodesOfType(VariableNode);
          assert.ok($isVariableNode(variableNode));
          // A DecoratorNode has no internal text to split — the editor can only select/delete it whole.
          assert.equal(
            variableNode.getTextContentSize(),
            variableNode.getTextContent().length,
          );
        });
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "undo reverts only the most recent discrete change",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => $selectAll());
          toggleMark(editor, "bold");
        });
        await act(async () => {
          editor.update(() => $selectAll());
          toggleMark(editor, "italic");
        });
        const beforeUndo = commits.at(-1)?.children[0];
        assert.ok(beforeUndo && beforeUndo.type === "paragraph");
        assert.ok(
          beforeUndo.children.some(
            (child) =>
              child.type === "text" &&
              child.marks.includes("bold") &&
              child.marks.includes("italic"),
          ),
        );

        commits.length = 0;
        await act(async () => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        });
        const undoneParagraph = commits.at(-1)?.children[0];
        assert.ok(
          undoneParagraph && undoneParagraph.type === "paragraph",
          "expected undo to commit a new paragraph state",
        );
        assert.ok(
          undoneParagraph.children.some(
            (child) => child.type === "text" && child.marks.includes("bold"),
          ),
        );
        assert.ok(
          undoneParagraph.children.every(
            (child) => child.type !== "text" || !child.marks.includes("italic"),
          ),
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "a complete known token typed as text becomes a recipient variable",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode("Hello %recipient.firstName%!"));
            $getRoot().clear().append(paragraph);
          });
        });

        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph?.type === "paragraph");
        assert.deepEqual(
          paragraph.children.map((child) => child.type),
          ["text", "variable", "text"],
        );
        const variable = paragraph.children[1];
        assert.ok(variable?.type === "variable");
        assert.equal(variable.variableKey, RECIPIENT_FIRST_NAME.key);
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "typed text matching the variable syntax without a real variable node is decorated as invalid, not committed as a variable",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        await act(async () => {
          editor.update(() => {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode("Save %unknown.token% today"));
            $getRoot().clear().append(paragraph);
          });
        });

        editor.getEditorState().read(() => {
          const invalidNodes = $nodesOfType(InvalidVariableTextNode);
          assert.ok(
            invalidNodes.length > 0,
            "expected the unresolved percent-token text to be wrapped",
          );
          assert.ok(
            invalidNodes.every((node) => $isInvalidVariableTextNode(node)),
          );
        });

        const paragraph = commits.at(-1)?.children[0];
        assert.ok(paragraph && paragraph.type === "paragraph");
        assert.ok(
          paragraph.children.every((child) => child.type !== "variable"),
        );
        assert.ok(
          paragraph.children.some(
            (child) =>
              child.type === "text" && child.text.includes("%unknown.token%"),
          ),
        );
      } finally {
        unmount();
      }
    },
  );

  await t.test(
    "pasted HTML with a script tag and font styling is normalized to plain formatted text",
    async () => {
      const { editor, commits, unmount } = mountEditor(requireRegistry());
      try {
        const html =
          '<p><script>alert(1)</script><span style="font-family: Comic Sans MS; font-size: 40px;" class="tracking-pixel"><b>Bold</b> pasted text</span></p>';
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/html", html);
        const pasteEvent = new ClipboardEvent("paste", { clipboardData });

        await act(async () => {
          editor.update(() => $selectAll());
          editor.dispatchCommand(PASTE_COMMAND, pasteEvent);
        });

        const last = commits.at(-1);
        const serialized = JSON.stringify(last);
        assert.doesNotMatch(serialized, /script/i);
        assert.doesNotMatch(serialized, /Comic Sans/i);
        assert.doesNotMatch(serialized, /tracking-pixel/i);

        const paragraph = last?.children[0];
        assert.ok(paragraph && paragraph.type === "paragraph");
        const text = paragraph.children
          .map((child) => (child.type === "text" ? child.text : ""))
          .join("");
        assert.equal(text, "Bold pasted text");
        assert.ok(
          paragraph.children.some(
            (child) =>
              child.type === "text" &&
              child.text === "Bold" &&
              child.marks.includes("bold"),
          ),
        );
      } finally {
        unmount();
      }
    },
  );
});
