// Wires a `RichTextEditor`'s `onCommit` to the headless controller's
// coalesced `update-rich-text` command (design.md decisions #5, #7; task
// 11.6). `dispatch` already coalesces consecutive rich-text edits to the
// same node under the `rich-text:${nodeId}` history key
// (`core/controller/commands.ts`); this just supplies that call with the
// converted AST.

import type { RichTextValue } from "../../types/index.js";
import type { BuilderController } from "../../core/controller/controller.js";

/** Returns an `onCommit` handler for `RichTextEditor` that dispatches the converted AST as a coalesced `update-rich-text` command against `nodeId`. */
export function createRichTextCommitHandler(
  controller: BuilderController,
  nodeId: string,
): (value: RichTextValue) => void {
  return (value: RichTextValue) => {
    controller.dispatch({ type: "update-rich-text", nodeId, value });
  };
}
