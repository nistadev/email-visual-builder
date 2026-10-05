// Converts an already-validated `RichTextValue` AST to semantic landing-page
// HTML (design.md decisions #7, #12; task 10.3). Mirrors the email
// renderer's mark/list handling but with plain semantic tags instead of a
// table-safe wrapper, and external-only `target`/`rel` on links.

import type {
  RichTextInlineNode,
  RichTextLinkChildNode,
  RichTextListItemNode,
  RichTextValue,
  TypographyValue,
  VisualDocumentLinkStyle,
} from "../../types/index.js";
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  serializeInlineStyle,
} from "../escape.js";
import { typographyStyleEntries } from "../style.js";
import { renderTemplatedValueAsText } from "../templated-text.js";
import { externalLinkAttributes } from "./external-link.js";

function renderMarkedText(
  node: Extract<RichTextInlineNode, { type: "text" }>,
): string {
  const textDecorations: string[] = [];
  if (node.marks.includes("underline")) textDecorations.push("underline");
  if (node.marks.includes("strikethrough"))
    textDecorations.push("line-through");

  const styleEntries: [string, string | null | undefined][] = [];
  if (node.color) styleEntries.push(["color", node.color]);
  if (node.highlightColor)
    styleEntries.push(["background-color", node.highlightColor]);
  if (node.fontFamily) styleEntries.push(["font-family", node.fontFamily]);
  if (textDecorations.length > 0)
    styleEntries.push(["text-decoration", textDecorations.join(" ")]);

  let html = escapeHtmlText(node.text);
  if (node.marks.includes("bold")) html = `<strong>${html}</strong>`;
  if (node.marks.includes("italic")) html = `<em>${html}</em>`;
  if (styleEntries.length > 0) {
    html = `<span style="${serializeInlineStyle(styleEntries)}">${html}</span>`;
  }
  return html;
}

function renderLinkChild(node: RichTextLinkChildNode): string {
  if (node.type === "text") return renderMarkedText(node);
  const token = escapeHtmlText(node.token);
  return node.marks?.includes("bold") ? `<strong>${token}</strong>` : token;
}

function renderInlineNode(
  node: RichTextInlineNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  switch (node.type) {
    case "text":
      return renderMarkedText(node);
    case "variable":
      return node.marks?.includes("bold")
        ? `<strong>${escapeHtmlText(node.token)}</strong>`
        : escapeHtmlText(node.token);
    case "break":
      return "<br>";
    case "link": {
      const href = renderTemplatedValueAsText(
        node.destination,
        escapeHtmlAttribute,
      );
      const style = serializeInlineStyle([
        ["color", linkStyle.color],
        ["text-decoration", linkStyle.underline ? "underline" : "none"],
      ]);
      const inner = node.children.map(renderLinkChild).join("");
      return `<a href="${href}" style="${style}"${externalLinkAttributes(href)}>${inner}</a>`;
    }
    default:
      return "";
  }
}

/** Renders rich content without block wrappers for headings and button labels. */
export function renderRichTextInlineHtml(
  value: RichTextValue,
  linkStyle: VisualDocumentLinkStyle,
  allowLinks = true,
): string {
  return value.children
    .flatMap((node) => {
      if (node.type === "paragraph") {
        return [
          node.children
            .map((child) =>
              child.type === "link" && !allowLinks
                ? child.children.map(renderLinkChild).join("")
                : renderInlineNode(child, linkStyle),
            )
            .join(""),
        ];
      }
      return node.children.map((item, index) => {
        const prefix = node.type === "numbered-list" ? `${index + 1}. ` : "• ";
        return (
          prefix +
          item.children
            .map((child) =>
              child.type === "link" && !allowLinks
                ? child.children.map(renderLinkChild).join("")
                : renderInlineNode(child, linkStyle),
            )
            .join("")
        );
      });
    })
    .join("<br>");
}

function renderListItem(
  item: RichTextListItemNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const inner = item.children
    .map((child) => renderInlineNode(child, linkStyle))
    .join("");
  return `<li>${inner}</li>`;
}

export function renderRichTextHtml(
  value: RichTextValue,
  typography: TypographyValue,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const style = serializeInlineStyle(typographyStyleEntries(typography));
  return value.children
    .map((node) => {
      if (node.type === "paragraph") {
        const inner = node.children
          .map((child) => renderInlineNode(child, linkStyle))
          .join("");
        const paragraphStyle = serializeInlineStyle([
          ...typographyStyleEntries(typography),
          ["text-align", node.align],
        ]);
        return `<p style="${paragraphStyle}">${inner || "&nbsp;"}</p>`;
      }
      const tag = node.type === "numbered-list" ? "ol" : "ul";
      const items = node.children
        .map((item) => renderListItem(item, linkStyle))
        .join("");
      return `<${tag} style="${style}">${items}</${tag}>`;
    })
    .join("");
}
