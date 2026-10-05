// Structural parsing of the owned rich-text AST (design.md decision #7).
// Semantic variable-token resolution is section 7's job — here a variable
// node only needs a non-empty key/token pair.

import type {
  RichTextAstNode,
  RichTextInlineNode,
  RichTextLinkChildNode,
  RichTextListItemNode,
  RichTextListKind,
  RichTextMark,
  RichTextValue,
} from "../../types/index.js";
import { CURRENT_BLOCK_VERSIONS } from "../versions.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseArray,
  parseEnum,
  parseHexColor,
  parseString,
} from "../primitives.js";
import { err, issue, ok, type ParseResult } from "../result.js";
import { parseHorizontalAlignment } from "./presentation.js";
import { parseTemplatedValue } from "./templated-value.js";

const MARKS: readonly RichTextMark[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
];
const LIST_KINDS: readonly RichTextListKind[] = [
  "bulleted-list",
  "numbered-list",
];

function parseMarks(value: unknown, path: string): ParseResult<RichTextMark[]> {
  const raw = parseArray(value, path);
  if (!raw.ok) return raw;
  const marks: RichTextMark[] = [];
  const issues = [];
  for (let index = 0; index < raw.value.length; index += 1) {
    const result = parseEnum(raw.value[index], MARKS, `${path}[${index}]`);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    marks.push(result.value);
  }
  return issues.length > 0 ? err(issues) : ok(marks);
}

function parseTextNode(
  value: Record<string, unknown>,
  path: string,
): ParseResult<RichTextInlineNode> {
  const text = parseString(value.text, `${path}.text`, { allowEmpty: true });
  if (!text.ok) return text;
  const marks = parseMarks(value.marks ?? [], `${path}.marks`);
  if (!marks.ok) return marks;

  const node: RichTextInlineNode = {
    type: "text",
    text: text.value,
    marks: marks.value,
  };
  if (value.color !== undefined) {
    const color = parseHexColor(value.color, `${path}.color`);
    if (!color.ok) return color;
    (node as { color?: string }).color = color.value;
  }
  if (value.highlightColor !== undefined) {
    const highlightColor = parseHexColor(
      value.highlightColor,
      `${path}.highlightColor`,
    );
    if (!highlightColor.ok) return highlightColor;
    (node as { highlightColor?: string }).highlightColor = highlightColor.value;
  }
  if (value.fontFamily !== undefined) {
    const fontFamily = parseString(value.fontFamily, `${path}.fontFamily`, {
      allowEmpty: false,
      maxLength: 200,
    });
    if (!fontFamily.ok) return fontFamily;
    (node as { fontFamily?: string }).fontFamily = fontFamily.value;
  }
  return ok(node);
}

function parseVariableNode(
  value: Record<string, unknown>,
  path: string,
): ParseResult<RichTextInlineNode> {
  const variableKey = parseString(value.variableKey, `${path}.variableKey`, {
    allowEmpty: false,
    maxLength: 200,
  });
  if (!variableKey.ok) return variableKey;
  const token = parseString(value.token, `${path}.token`, {
    allowEmpty: false,
    maxLength: 200,
  });
  if (!token.ok) return token;
  const marks = parseMarks(value.marks ?? [], `${path}.marks`);
  if (!marks.ok) return marks;
  return ok({
    type: "variable",
    variableKey: variableKey.value,
    token: token.value,
    marks: marks.value,
  });
}

function parseBreakNode(): ParseResult<RichTextInlineNode> {
  return ok({ type: "break" });
}

function parseLinkChildNode(
  value: unknown,
  path: string,
): ParseResult<RichTextLinkChildNode> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected an inline node at "${path}".`, {
        path,
      }),
    ]);
  }
  if (value.type === "text")
    return parseTextNode(value, path) as ParseResult<RichTextLinkChildNode>;
  if (value.type === "variable")
    return parseVariableNode(value, path) as ParseResult<RichTextLinkChildNode>;
  return err([
    issue(
      "value/invalid-link-child",
      `Link children at "${path}" must be "text" or "variable" nodes.`,
      { path },
    ),
  ]);
}

function parseLinkNode(
  value: Record<string, unknown>,
  path: string,
): ParseResult<RichTextInlineNode> {
  const destination = parseTemplatedValue(
    value.destination,
    `${path}.destination`,
  );
  if (!destination.ok) return destination;
  const rawChildren = parseArray(value.children, `${path}.children`);
  if (!rawChildren.ok) return rawChildren;

  const children: RichTextLinkChildNode[] = [];
  const issues = [];
  for (let index = 0; index < rawChildren.value.length; index += 1) {
    const result = parseLinkChildNode(
      rawChildren.value[index],
      `${path}.children[${index}]`,
    );
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    children.push(result.value);
  }
  if (issues.length > 0) return err(issues);
  return ok({ type: "link", destination: destination.value, children });
}

function parseInlineNode(
  value: unknown,
  path: string,
): ParseResult<RichTextInlineNode> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected an inline node at "${path}".`, {
        path,
      }),
    ]);
  }
  switch (value.type) {
    case "text":
      return parseTextNode(value, path);
    case "variable":
      return parseVariableNode(value, path);
    case "break":
      return parseBreakNode();
    case "link":
      return parseLinkNode(value, path);
    default:
      return err([
        issue(
          "value/invalid-inline-node-type",
          `Unknown inline node type at "${path}".`,
          { path },
        ),
      ]);
  }
}

function parseInlineNodes(
  value: unknown,
  path: string,
): ParseResult<RichTextInlineNode[]> {
  const raw = parseArray(value, path);
  if (!raw.ok) return raw;
  const nodes: RichTextInlineNode[] = [];
  const issues = [];
  for (let index = 0; index < raw.value.length; index += 1) {
    const result = parseInlineNode(raw.value[index], `${path}[${index}]`);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    nodes.push(result.value);
  }
  return issues.length > 0 ? err(issues) : ok(nodes);
}

function parseParagraphNode(
  value: Record<string, unknown>,
  path: string,
): ParseResult<RichTextAstNode> {
  const align = parseHorizontalAlignment(value.align, `${path}.align`);
  if (!align.ok) return align;
  const children = parseInlineNodes(value.children, `${path}.children`);
  if (!children.ok) return children;
  return ok({
    type: "paragraph",
    align: align.value,
    children: children.value,
  });
}

function parseListItemNode(
  value: unknown,
  path: string,
): ParseResult<RichTextListItemNode> {
  if (!isPlainObject(value) || value.type !== "list-item") {
    return err([
      issue(
        "value/invalid-list-item",
        `Expected a "list-item" node at "${path}".`,
        { path },
      ),
    ]);
  }
  const children = parseInlineNodes(value.children, `${path}.children`);
  if (!children.ok) return children;
  return ok({ type: "list-item", children: children.value });
}

function parseListNode(
  value: Record<string, unknown>,
  path: string,
): ParseResult<RichTextAstNode> {
  const kind = parseEnum(value.type, LIST_KINDS, `${path}.type`);
  if (!kind.ok) return kind;
  const rawItems = parseArray(value.children, `${path}.children`);
  if (!rawItems.ok) return rawItems;

  const items: RichTextListItemNode[] = [];
  const issues = [];
  for (let index = 0; index < rawItems.value.length; index += 1) {
    const result = parseListItemNode(
      rawItems.value[index],
      `${path}.children[${index}]`,
    );
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    items.push(result.value);
  }
  if (issues.length > 0) return err(issues);
  return ok({ type: kind.value, children: items });
}

function parseAstNode(
  value: unknown,
  path: string,
): ParseResult<RichTextAstNode> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a rich-text block node at "${path}".`,
        { path },
      ),
    ]);
  }
  if (value.type === "paragraph") return parseParagraphNode(value, path);
  if (value.type === "bulleted-list" || value.type === "numbered-list")
    return parseListNode(value, path);
  return err([
    issue(
      "value/invalid-rich-text-block-type",
      `Rich-text block at "${path}" must be "paragraph", "bulleted-list", or "numbered-list".`,
      { path },
    ),
  ]);
}

export function parseRichTextValue(
  value: unknown,
  path: string,
): ParseResult<RichTextValue> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a rich-text value at "${path}".`, {
        path,
      }),
    ]);
  }
  if (value.kind !== "donativus.rich-text") {
    return err([
      issue(
        "value/invalid-rich-text-kind",
        `Rich-text value at "${path}" has an unrecognized "kind".`,
        { path },
      ),
    ]);
  }
  if (value.version !== CURRENT_BLOCK_VERSIONS["rich-text"]) {
    return err([
      issue(
        "value/unsupported-rich-text-version",
        `Rich-text value at "${path}" declares an unsupported version.`,
        { path },
      ),
    ]);
  }
  const rawChildren = parseArray(value.children, `${path}.children`);
  if (!rawChildren.ok) return rawChildren;

  const children: RichTextAstNode[] = [];
  const issues = [];
  let approximateBytes = 0;
  for (let index = 0; index < rawChildren.value.length; index += 1) {
    const result = parseAstNode(
      rawChildren.value[index],
      `${path}.children[${index}]`,
    );
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    children.push(result.value);
  }
  if (issues.length > 0) return err(issues);

  approximateBytes = JSON.stringify(children).length;
  if (approximateBytes > VISUAL_DOCUMENT_LIMITS.maxRichTextBytes) {
    return err([
      issue(
        "value/rich-text-too-large",
        `Rich-text value at "${path}" exceeds the maximum size.`,
        { path },
      ),
    ]);
  }

  return ok({
    kind: "donativus.rich-text",
    version: CURRENT_BLOCK_VERSIONS["rich-text"],
    children,
  });
}
