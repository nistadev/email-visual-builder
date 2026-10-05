// The package-owned rich-text AST persisted by the `rich-text` block. The
// React entrypoint's Lexical adapter converts to/from this shape on load and
// committed change; Lexical's own JSON is never persisted. See design.md
// decision #7.

import type { PositiveInteger } from "./shared.js";
import type { HorizontalAlignment } from "./presentation.js";
import type { TemplatedValue } from "./variables.js";

export type RichTextMark = "bold" | "italic" | "underline" | "strikethrough";

export interface RichTextTextNode {
  type: "text";
  text: string;
  marks: RichTextMark[];
  color?: string;
  highlightColor?: string;
  /** A full CSS font stack; absent means the block typography applies. */
  fontFamily?: string;
}

/** An atomic, one-unit cursor/delete token — never a decorated string match. */
export interface RichTextVariableNode {
  type: "variable";
  variableKey: string;
  /** Exact configured token, preserved verbatim through export. */
  token: string;
  marks?: RichTextMark[];
}

export interface RichTextBreakNode {
  type: "break";
}

export type RichTextLinkChildNode = RichTextTextNode | RichTextVariableNode;

export interface RichTextLinkNode {
  type: "link";
  destination: TemplatedValue;
  children: RichTextLinkChildNode[];
}

export type RichTextInlineNode =
  | RichTextTextNode
  | RichTextVariableNode
  | RichTextBreakNode
  | RichTextLinkNode;

export interface RichTextParagraphNode {
  type: "paragraph";
  align: HorizontalAlignment;
  children: RichTextInlineNode[];
}

export interface RichTextListItemNode {
  type: "list-item";
  children: RichTextInlineNode[];
}

export type RichTextListKind = "bulleted-list" | "numbered-list";

export interface RichTextListNode {
  type: RichTextListKind;
  children: RichTextListItemNode[];
}

export type RichTextAstNode = RichTextParagraphNode | RichTextListNode;

export interface RichTextValue {
  kind: "donativus.rich-text";
  version: PositiveInteger;
  children: RichTextAstNode[];
}
