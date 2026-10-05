// Formatting controls for the rich-text adapter (design.md decision #7,
// task 11.4): bold/italic/underline/strikethrough, foreground/highlight
// color, lists, paragraph alignment, links, and clear-formatting. Every
// function dispatches through Lexical's own commands/selection APIs — none
// of them touch the AST directly; the committed AST is always derived from
// the resulting editor state (see `sync-plugin.tsx`).

import type { RichTextMark } from "../../types/index.js";
import type { ElementFormatType, LexicalEditor } from "lexical";
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { $patchStyleText } from "@lexical/selection";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $isVariableNode } from "./variable-node.js";

const TEXT_MARKS: readonly RichTextMark[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
];

export function toggleMark(editor: LexicalEditor, mark: RichTextMark): void {
  let onlyVariablesSelected = false;
  editor.update(() => {
    const selection = $getSelection();
    if (!selection) return;
    const nodes = selection.getNodes();
    onlyVariablesSelected =
      $isNodeSelection(selection) &&
      nodes.every((node) => $isVariableNode(node));
    for (const node of nodes) {
      if (!$isVariableNode(node)) continue;
      const writable = node.getWritable();
      writable.__marks = writable.__marks.includes(mark)
        ? writable.__marks.filter((item) => item !== mark)
        : [...writable.__marks, mark];
    }
  });
  // A pure variable-only selection has no TextNode to format; dispatching
  // FORMAT_TEXT_COMMAND there is a no-op anyway, but skip it for clarity.
  if (onlyVariablesSelected) return;
  editor.dispatchCommand(FORMAT_TEXT_COMMAND, mark);
}

export function setForegroundColor(
  editor: LexicalEditor,
  color: string | null,
): void {
  editor.update(() => {
    const selection = $getSelection();
    if (selection) $patchStyleText(selection, { color });
  });
}

export function setHighlightColor(
  editor: LexicalEditor,
  color: string | null,
): void {
  editor.update(() => {
    const selection = $getSelection();
    if (selection) $patchStyleText(selection, { "background-color": color });
  });
}

/** `fontFamily === null` returns the run to the block typography. */
export function setFontFamily(
  editor: LexicalEditor,
  fontFamily: string | null,
): void {
  editor.update(() => {
    const selection = $getSelection();
    if (selection) $patchStyleText(selection, { "font-family": fontFamily });
  });
}

export function setParagraphAlignment(
  editor: LexicalEditor,
  align: "left" | "center" | "right",
): void {
  editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align as ElementFormatType);
}

export function insertUnorderedList(editor: LexicalEditor): void {
  editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
}

export function insertOrderedList(editor: LexicalEditor): void {
  editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
}

export function removeList(editor: LexicalEditor): void {
  editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
}

/** `url === null` removes the link on the current selection. */
export function toggleLink(editor: LexicalEditor, url: string | null): void {
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
}

/**
 * Removes bold/italic/underline/strikethrough and foreground/highlight color
 * from the current selection without touching structural content (lists,
 * links, alignment). `dispatchCommand` starts its own top-level update, so
 * the active marks are read first and each toggle is dispatched afterward —
 * never nested inside another `editor.update()` call, which Lexical does
 * not apply mid-transaction.
 */
export function clearFormatting(editor: LexicalEditor): void {
  const activeMarks: RichTextMark[] = [];
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    for (const mark of TEXT_MARKS) {
      if (selection.hasFormat(mark)) activeMarks.push(mark);
    }
  });
  for (const mark of activeMarks) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, mark);
  }
  editor.update(() => {
    const selection = $getSelection();
    if (selection)
      $patchStyleText(selection, {
        color: null,
        "background-color": null,
        "font-family": null,
      });
  });
}
