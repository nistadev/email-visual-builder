// Paste normalization (design.md decision #7, task 11.5). Pasted HTML is
// converted through Lexical's own DOM importers, which only recognize the
// node types this editor registers (paragraphs, lists, links, marked text)
// — fonts, sizes, classes, tables, embedded images, scripts, and event
// handlers have no registered importer and are dropped during import.
// `<script>`/`<style>` tags are additionally ignored outright by
// `$generateNodesFromDOM` itself. The committed AST projection
// (`$readRichTextValueFromEditor`) is the second, stricter layer of this
// same defense — see its module comment.

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateNodesFromDOM } from "@lexical/html";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";

export function PasteNormalizationPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const html = event.clipboardData?.getData("text/html");
        if (!html) return false;

        event.preventDefault();
        editor.update(() => {
          const dom = new DOMParser().parseFromString(html, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            $insertNodes(nodes);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
}
