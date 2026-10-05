// Reads the current Lexical editor state back into the owned rich-text
// AST (design.md decision #7, task 11.2). Every function here must run
// inside `editor.getEditorState().read()` or `editor.update()`. This is a
// strict allowlist projection — any pasted/imported Lexical node type or
// style this module doesn't recognize is simply not represented in the
// output, which is what makes it double as paste normalization (task 11.5):
// nothing reaches the committed AST that this converter doesn't explicitly
// understand.

import type {
  HorizontalAlignment,
  RichTextAstNode,
  RichTextInlineNode,
  RichTextLinkChildNode,
  RichTextListItemNode,
  RichTextMark,
  RichTextValue,
} from "../../types/index.js";
import type { ElementNode, LexicalNode, TextNode } from "lexical";
import {
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  $getRoot,
} from "lexical";
import { $isLinkNode } from "@lexical/link";
import { $isListItemNode, $isListNode } from "@lexical/list";
import type { VariableRegistry } from "../../core/registry/types.js";
import { isCatalogueFont } from "../../core/fonts.js";
import { CURRENT_BLOCK_VERSIONS } from "../../core/versions.js";
import { $isVariableNode } from "./variable-node.js";
import { editableStringToTemplatedValue } from "./templated-value-editing.js";

const TEXT_MARKS: readonly RichTextMark[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
];
const HORIZONTAL_ALIGNMENTS: readonly HorizontalAlignment[] = [
  "left",
  "center",
  "right",
];

function parseInlineStyleValue(
  style: string,
  property: "color" | "background-color" | "font-family",
): string | undefined {
  const pattern = new RegExp(
    `(?:^|;)\\s*${property}\\s*:\\s*([^;]+?)\\s*(?:;|$)`,
    "i",
  );
  const match = pattern.exec(style);
  return match?.[1]?.trim();
}

function $convertTextNode(node: TextNode): RichTextInlineNode {
  const marks = TEXT_MARKS.filter((mark) => node.hasFormat(mark));
  const style = node.getStyle();
  const color = parseInlineStyleValue(style, "color");
  const highlightColor = parseInlineStyleValue(style, "background-color");
  // Only a catalogue entry is kept: this is the paste boundary, and a font
  // carried in from another document is not something the author chose.
  const fontFamily = parseInlineStyleValue(style, "font-family");
  return {
    type: "text",
    text: node.getTextContent(),
    marks,
    ...(color ? { color } : {}),
    ...(highlightColor ? { highlightColor } : {}),
    ...(fontFamily && isCatalogueFont(fontFamily) ? { fontFamily } : {}),
  };
}

function $convertLinkChild(node: LexicalNode): RichTextLinkChildNode | null {
  if ($isVariableNode(node)) {
    return {
      type: "variable",
      variableKey: node.__variableKey,
      token: node.__token,
      ...(node.__marks.length > 0 ? { marks: [...node.__marks] } : {}),
    };
  }
  if ($isTextNode(node)) {
    return $convertTextNode(node) as RichTextLinkChildNode;
  }
  return null;
}

function $convertInlineChildren(
  parent: ElementNode,
  registry: VariableRegistry,
): RichTextInlineNode[] {
  const result: RichTextInlineNode[] = [];
  for (const child of parent.getChildren()) {
    if ($isLineBreakNode(child)) {
      result.push({ type: "break" });
      continue;
    }
    if ($isVariableNode(child)) {
      result.push({
        type: "variable",
        variableKey: child.__variableKey,
        token: child.__token,
        ...(child.__marks.length > 0 ? { marks: [...child.__marks] } : {}),
      });
      continue;
    }
    if ($isTextNode(child)) {
      result.push($convertTextNode(child));
      continue;
    }
    if ($isLinkNode(child)) {
      const children = child
        .getChildren()
        .map($convertLinkChild)
        .filter(
          (linkChild): linkChild is RichTextLinkChildNode => linkChild !== null,
        );
      result.push({
        type: "link",
        destination: editableStringToTemplatedValue(child.getURL(), registry),
        children,
      });
    }
    // Any other child type (an unregistered pasted element, e.g. a table cell) is dropped —
    // it never had a registered Lexical node class to become in the first place.
  }
  return result;
}

function $convertAlignment(node: ElementNode): HorizontalAlignment {
  const format = node.getFormatType();
  return (HORIZONTAL_ALIGNMENTS as readonly string[]).includes(format)
    ? (format as HorizontalAlignment)
    : "left";
}

function $convertListItem(
  node: ElementNode,
  registry: VariableRegistry,
): RichTextListItemNode {
  return {
    type: "list-item",
    children: $convertInlineChildren(node, registry),
  };
}

function $convertBlockNode(
  node: LexicalNode,
  registry: VariableRegistry,
): RichTextAstNode | null {
  if ($isParagraphNode(node)) {
    return {
      type: "paragraph",
      align: $convertAlignment(node),
      children: $convertInlineChildren(node, registry),
    };
  }
  if ($isListNode(node)) {
    const items = node
      .getChildren()
      .filter($isListItemNode)
      .map((item) => $convertListItem(item, registry));
    return {
      type: node.getListType() === "number" ? "numbered-list" : "bulleted-list",
      children: items,
    };
  }
  return null;
}

/** Reads the whole editor tree. Must run inside `editor.getEditorState().read()` or `editor.update()`. */
export function $readRichTextValueFromEditor(
  registry: VariableRegistry,
): RichTextValue {
  const root = $getRoot();
  const children: RichTextAstNode[] = [];
  for (const node of root.getChildren()) {
    if (!$isElementNode(node)) continue;
    const converted = $convertBlockNode(node, registry);
    if (converted) children.push(converted);
  }
  return {
    kind: "donativus.rich-text",
    version: CURRENT_BLOCK_VERSIONS["rich-text"],
    children,
  };
}
