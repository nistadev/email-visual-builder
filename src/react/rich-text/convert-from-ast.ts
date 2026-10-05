// Populates a Lexical editor from the owned rich-text AST (design.md
// decision #7, task 11.2). Every function here is an `$`-prefixed Lexical
// convention: it must run inside `editor.update()`.

import type {
  RichTextAstNode,
  RichTextInlineNode,
  RichTextListItemNode,
  RichTextValue,
} from "../../types/index.js";
import type { ElementNode } from "lexical";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
} from "lexical";
import { $createLinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import type { VariableRegistry } from "../../core/registry/types.js";
import { $createVariableNode } from "./variable-node.js";
import { templatedValueToEditableString } from "./templated-value-editing.js";

function $appendInlineNode(
  parent: ElementNode,
  node: RichTextInlineNode,
  registry: VariableRegistry,
): void {
  if (node.type === "text") {
    const textNode = $createTextNode(node.text);
    for (const mark of node.marks) textNode.toggleFormat(mark);
    const styleParts: string[] = [];
    if (node.color) styleParts.push(`color: ${node.color}`);
    if (node.highlightColor)
      styleParts.push(`background-color: ${node.highlightColor}`);
    if (node.fontFamily) styleParts.push(`font-family: ${node.fontFamily}`);
    if (styleParts.length > 0) textNode.setStyle(`${styleParts.join("; ")};`);
    parent.append(textNode);
    return;
  }
  if (node.type === "variable") {
    const definition = registry.get(node.variableKey);
    const resolved =
      definition !== undefined && definition.token === node.token;
    parent.append(
      $createVariableNode(
        node.variableKey,
        node.token,
        definition?.label ?? node.variableKey,
        definition?.sampleValue ?? null,
        resolved,
        node.marks ?? [],
      ),
    );
    return;
  }
  if (node.type === "break") {
    parent.append($createLineBreakNode());
    return;
  }
  // link
  const linkNode = $createLinkNode(
    templatedValueToEditableString(node.destination),
  );
  for (const child of node.children)
    $appendInlineNode(linkNode, child, registry);
  parent.append(linkNode);
}

function $appendListItem(
  list: ElementNode,
  item: RichTextListItemNode,
  registry: VariableRegistry,
): void {
  const itemNode = $createListItemNode();
  for (const child of item.children)
    $appendInlineNode(itemNode, child, registry);
  list.append(itemNode);
}

function $appendBlockNode(
  root: ElementNode,
  node: RichTextAstNode,
  registry: VariableRegistry,
): void {
  if (node.type === "paragraph") {
    const paragraph = $createParagraphNode();
    paragraph.setFormat(node.align);
    for (const child of node.children)
      $appendInlineNode(paragraph, child, registry);
    root.append(paragraph);
    return;
  }
  const list = $createListNode(
    node.type === "numbered-list" ? "number" : "bullet",
  );
  for (const item of node.children) $appendListItem(list, item, registry);
  root.append(list);
}

/** Clears the editor's root and rebuilds it from `value`. Must run inside `editor.update()`. */
export function $populateEditorFromRichTextValue(
  value: RichTextValue,
  registry: VariableRegistry,
): void {
  const root = $getRoot();
  root.clear();
  if (value.children.length === 0) {
    root.append($createParagraphNode());
    return;
  }
  for (const node of value.children) $appendBlockNode(root, node, registry);
}
