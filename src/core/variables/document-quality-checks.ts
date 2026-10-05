// Non-blocking link/destination quality checks (design.md decision #10,
// task 7.6). These never rewrite or auto-insert content — they only report
// warnings for the export result to surface.

import type {
  RichTextAstNode,
  RichTextInlineNode,
  RichTextValue,
  TemplatedValue,
  VisualDocument,
  VisualDocumentQualityWarning,
} from "../../types/index.js";
import type { VariableRegistry } from "../registry/types.js";
import { resolveVariableReference } from "./resolve.js";

function isTemplatedValueEmpty(value: TemplatedValue): boolean {
  return value.segments.every(
    (segment) =>
      segment.kind === "literal" && segment.value.trim().length === 0,
  );
}

function templatedValueHasSystemLinkVariable(
  value: TemplatedValue,
  registry: VariableRegistry,
): boolean {
  return value.segments.some((segment) => {
    if (segment.kind !== "variable") return false;
    const resolution = resolveVariableReference(
      segment.variableKey,
      segment.token,
      registry,
      "",
    );
    return (
      resolution.ok &&
      resolution.definition.allowedContexts.includes("email-system-link")
    );
  });
}

function inlineNodeHasVisibleText(node: RichTextInlineNode): boolean {
  if (node.type === "text") return node.text.trim().length > 0;
  if (node.type === "variable") return true;
  if (node.type === "link") return node.children.some(inlineNodeHasVisibleText);
  return false;
}

function richTextValueHasVisibleText(value: RichTextValue): boolean {
  return value.children.some((node) =>
    node.type === "paragraph"
      ? node.children.some(inlineNodeHasVisibleText)
      : node.children.some((item) =>
          item.children.some(inlineNodeHasVisibleText),
        ),
  );
}

function collectLinkNodes(
  nodes: RichTextAstNode[],
): { destination: TemplatedValue; hasVisibleText: boolean }[] {
  const links: { destination: TemplatedValue; hasVisibleText: boolean }[] = [];
  const visitInline = (node: RichTextInlineNode): void => {
    if (node.type === "link") {
      links.push({
        destination: node.destination,
        hasVisibleText: node.children.some(inlineNodeHasVisibleText),
      });
      node.children.forEach(visitInline);
    }
  };
  for (const node of nodes) {
    if (node.type === "paragraph") {
      node.children.forEach(visitInline);
    } else {
      node.children.forEach((item) => item.children.forEach(visitInline));
    }
  }
  return links;
}

/**
 * Warns on empty CTA/link destinations and missing/invisible link labels.
 * Does not walk unavailable nodes — their raw props are opaque.
 */
export function collectLinkQualityWarnings(
  document: VisualDocument,
): VisualDocumentQualityWarning[] {
  const warnings: VisualDocumentQualityWarning[] = [];
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    if ("unavailable" in node) continue;
    if (node.type === "cta") {
      if (isTemplatedValueEmpty(node.props.destination)) {
        warnings.push({
          code: "quality/empty-cta-destination",
          message: `Call-to-action "${nodeId}" has no destination.`,
          nodeId,
          path: "props.destination",
        });
      }
      if (!richTextValueHasVisibleText(node.props.label)) {
        warnings.push({
          code: "quality/missing-cta-label",
          message: `Call-to-action "${nodeId}" has no visible label.`,
          nodeId,
          path: "props.label",
        });
      }
    }
    if (node.type === "rich-text") {
      for (const link of collectLinkNodes(node.props.value.children)) {
        if (isTemplatedValueEmpty(link.destination)) {
          warnings.push({
            code: "quality/empty-link-destination",
            message: `Rich-text block "${nodeId}" contains a link with no destination.`,
            nodeId,
            path: "props.value",
          });
        }
        if (!link.hasVisibleText) {
          warnings.push({
            code: "quality/empty-link-label",
            message: `Rich-text block "${nodeId}" contains a link with no visible text.`,
            nodeId,
            path: "props.value",
          });
        }
      }
    }
    if (node.type === "social") {
      node.props.items.forEach((item, index) => {
        if (item.url.trim().length === 0) {
          warnings.push({
            code: "quality/empty-social-link",
            message: `Social icons block "${nodeId}" has a ${item.platform} icon with no link.`,
            nodeId,
            path: `props.items[${index}].url`,
          });
        }
      });
    }
  }
  return warnings;
}

/**
 * Email documents warn (never block) when no reachable CTA or rich-text
 * link destination carries a variable typed for the "email-system-link"
 * context (the marketing integration's unsubscribe token). Landing pages
 * have no such requirement.
 */
export function collectUnsubscribeLinkWarning(
  document: VisualDocument,
  registry: VariableRegistry,
): VisualDocumentQualityWarning[] {
  if (document.mode !== "email") return [];

  for (const node of Object.values(document.nodes)) {
    if ("unavailable" in node) continue;
    if (
      node.type === "cta" &&
      templatedValueHasSystemLinkVariable(node.props.destination, registry)
    ) {
      return [];
    }
    if (node.type === "rich-text") {
      const hasSystemLink = collectLinkNodes(node.props.value.children).some(
        (link) =>
          templatedValueHasSystemLinkVariable(link.destination, registry),
      );
      if (hasSystemLink) return [];
    }
  }

  return [
    {
      code: "document/missing-unsubscribe-link",
      message:
        "No call-to-action or rich-text link uses an unsubscribe (email-system-link) variable.",
    },
  ];
}
