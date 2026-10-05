// The React-only Lexical composition (design.md decision #7, task 11.1).
// Persists only the owned AST — Lexical's own JSON is never read or
// written by this component; every commit goes through
// `$readRichTextValueFromEditor`.
//
// Contract for callers (this is deliberately *not* a fully self-syncing
// controlled component — the full controller/undo wiring is section 12's
// job):
// - Mount a fresh instance per edited node (`key={nodeId}`) so switching the
//   selected block naturally resets Lexical's internal state through
//   `initialValue`.
// - Bump `resyncToken` (e.g. an undo/redo counter) to force the *same*
//   instance to discard local edits and reload `initialValue` — normal
//   typing never touches it, so it never fights the user's cursor.
// - `onCommit` fires with the converted AST on every non-selection-only
//   change; it does not itself talk to a controller — pass
//   `createRichTextCommitHandler(controller, nodeId)` (`controller-commit.ts`)
//   as `onCommit`, which dispatches the coalesced `update-rich-text` command.

import type {
  RichTextValue,
  VariableDefinition,
  VisualDocumentLinkStyle,
} from "../../types/index.js";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import type { EditorState, LexicalEditor } from "lexical";
import { useEffect, type CSSProperties, type Ref } from "react";
import type { VariableRegistry } from "../../core/registry/types.js";
import { $populateEditorFromRichTextValue } from "./convert-from-ast.js";
import { $readRichTextValueFromEditor } from "./convert-to-ast.js";
import { InvalidVariableTextNode } from "./invalid-variable-text-node.js";
import { InvalidVariablePlugin } from "./plugins/invalid-variable-plugin.js";
import {
  FloatingFormattingToolbarPlugin,
  type RichTextFormattingLabels,
} from "./plugins/floating-formatting-toolbar.js";
import { PasteNormalizationPlugin } from "./plugins/paste-normalization-plugin.js";
import { VariablePickerPlugin } from "./plugins/variable-picker-plugin.js";
import { VariableInsertControlPlugin } from "./plugins/variable-insert-control.js";
import {
  VariableNode,
  VariablePreviewModeContext,
  type VariablePreviewMode,
} from "./variable-node.js";

const EXTERNAL_RESYNC_TAG = "donativus-rich-text-external-resync";

export interface RichTextEditorProps {
  initialValue: RichTextValue;
  registry: VariableRegistry;
  variables: readonly VariableDefinition[];
  onCommit: (value: RichTextValue) => void;
  /** Bump to force this instance to discard local edits and reload `initialValue` (e.g. after an external undo/redo). */
  resyncToken?: number;
  previewMode?: VariablePreviewMode;
  placeholder?: string;
  namespace?: string;
  ariaLabel?: string;
  contentEditableClassName?: string;
  autoFocus?: boolean;
  showVariableInsert?: boolean;
  variableButtonLabel?: string;
  /** Shows selection-anchored inline formatting and link controls. */
  showFormattingToolbar?: boolean;
  /** CTA labels are inside an anchor already, so they can format text but cannot contain a nested link. */
  allowLinks?: boolean;
  /** Document-level link presentation used by the editable Lexical anchors. */
  linkStyle?: VisualDocumentLinkStyle;
  formattingLabels?: RichTextFormattingLabels;
  /** Exposes the live `LexicalEditor` instance — a toolbar rendered outside this component (section 12) dispatches `formatting-commands.ts` calls against it. */
  editorRef?: Ref<LexicalEditor>;
}

function ResyncOnTokenChangePlugin({
  value,
  registry,
  resyncToken,
}: {
  value: RichTextValue;
  registry: VariableRegistry;
  resyncToken: number | undefined;
}): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (resyncToken === undefined) return;
    editor.update(() => $populateEditorFromRichTextValue(value, registry), {
      tag: EXTERNAL_RESYNC_TAG,
    });
    // Only `resyncToken` should retrigger this — resyncing on every `value`/`registry`
    // identity change would fight the user's cursor on their own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncToken]);
  return null;
}

export function RichTextEditor({
  initialValue,
  registry,
  variables,
  onCommit,
  resyncToken,
  previewMode = "token",
  placeholder,
  namespace = "donativus-visual-builder-rich-text",
  ariaLabel,
  contentEditableClassName = "donativus-vb-rich-text-content",
  autoFocus = false,
  showVariableInsert = false,
  variableButtonLabel = "+ Add variable",
  showFormattingToolbar = false,
  allowLinks = true,
  linkStyle,
  formattingLabels,
  editorRef,
}: RichTextEditorProps): React.JSX.Element {
  const editableLinkStyle = linkStyle
    ? ({
        "--donativus-vb-link-color": linkStyle.color,
        "--donativus-vb-link-text-decoration": linkStyle.underline
          ? "underline"
          : "none",
      } as CSSProperties)
    : undefined;
  const initialConfig = {
    namespace,
    theme: {
      link: "donativus-vb-rich-text-link",
      text: {
        bold: "donativus-vb-rich-text-bold",
        italic: "donativus-vb-rich-text-italic",
        underline: "donativus-vb-rich-text-underline",
        strikethrough: "donativus-vb-rich-text-strikethrough",
        underlineStrikethrough:
          "donativus-vb-rich-text-underline-strikethrough",
      },
    },
    nodes: [
      ListNode,
      ListItemNode,
      LinkNode,
      VariableNode,
      InvalidVariableTextNode,
    ],
    onError(error: Error): void {
      throw error;
    },
    editorState: () => {
      $populateEditorFromRichTextValue(initialValue, registry);
    },
  };

  const handleChange = (
    editorState: EditorState,
    _editor: LexicalEditor,
    tags: Set<string>,
  ): void => {
    // The canvas and inspector can both host an editor for the selected node.
    // Reloading one from the controller must not be mistaken for a user edit,
    // otherwise both editors commit each other's reloads indefinitely.
    if (tags.has(EXTERNAL_RESYNC_TAG)) return;
    editorState.read(() => {
      onCommit($readRichTextValueFromEditor(registry));
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <VariablePreviewModeContext.Provider value={previewMode}>
        {showVariableInsert ? (
          <VariableInsertControlPlugin
            variables={variables}
            label={variableButtonLabel}
          />
        ) : null}
        <RichTextPlugin
          contentEditable={
            placeholder ? (
              <ContentEditable
                className={contentEditableClassName}
                aria-label={ariaLabel}
                aria-placeholder={placeholder}
                style={editableLinkStyle}
                placeholder={
                  <div className="donativus-vb-rich-text-placeholder">
                    {placeholder}
                  </div>
                }
              />
            ) : (
              <ContentEditable
                className={contentEditableClassName}
                aria-label={ariaLabel}
                style={editableLinkStyle}
              />
            )
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <InvalidVariablePlugin registry={registry} />
        <VariablePickerPlugin variables={variables} />
        <PasteNormalizationPlugin />
        {showFormattingToolbar && formattingLabels ? (
          <FloatingFormattingToolbarPlugin
            variables={variables}
            allowLinks={allowLinks}
            labels={formattingLabels}
          />
        ) : null}
        {autoFocus ? <AutoFocusPlugin /> : null}
        {/*
         * `ignoreHistoryMergeTagChange` defaults to true in OnChangePlugin, which would
         * silently drop most keystrokes: Lexical/HistoryPlugin tags nearly every routine
         * edit "history-merge" (that tag governs *its own* undo-coalescing, unrelated to
         * ours). We want every non-selection-only change to reach `onCommit` — this
         * component's own controller integration owns coalescing (design.md decision #5,
         * `coalesceKeyFor` in `core/controller/commands.ts`), so Lexical's tag must not
         * gate it here.
         */}
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange={false}
          onChange={handleChange}
        />
        <ResyncOnTokenChangePlugin
          value={initialValue}
          registry={registry}
          resyncToken={resyncToken}
        />
        {editorRef ? <EditorRefPlugin editorRef={editorRef} /> : null}
      </VariablePreviewModeContext.Provider>
    </LexicalComposer>
  );
}
