// Walks a parsed `RichTextValue`, resolving every variable node against the
// registry and validating link destinations (design.md decisions #7-#8,
// tasks 7.2/7.5). Inline body text/variables always use the "text" context;
// a link's `destination` uses "url" — its own visible children remain
// ordinary "text"-context inline content.

import type {
  RichTextAstNode,
  RichTextInlineNode,
  RichTextValue,
  VisualDocumentValidationIssue,
} from "../../types/index.js";
import type { VariableRegistry } from "../registry/types.js";
import type { UrlValidationOptions } from "../url.js";
import { resolveVariableReference } from "./resolve.js";
import { checkLiteralTextForUnresolvedVariables } from "./unresolved-text.js";
import { validateTemplatedValue } from "./validate-templated-value.js";

function validateInlineNode(
  node: RichTextInlineNode,
  registry: VariableRegistry,
  path: string,
  urlOptions: UrlValidationOptions,
): VisualDocumentValidationIssue[] {
  if (node.type === "text") {
    return checkLiteralTextForUnresolvedVariables(
      node.text,
      registry,
      `${path}.text`,
    );
  }
  if (node.type === "variable") {
    const resolution = resolveVariableReference(
      node.variableKey,
      node.token,
      registry,
      path,
    );
    if (!resolution.ok) return [resolution.issue];
    if (!resolution.definition.allowedContexts.includes("text")) {
      return [
        {
          code: "value/variable-context-not-allowed",
          message: `Variable "${node.variableKey}" at "${path}" is not allowed in a "text" context.`,
          path,
        },
      ];
    }
    return [];
  }
  if (node.type === "break") return [];

  const issues: VisualDocumentValidationIssue[] = [];
  issues.push(
    ...validateTemplatedValue(
      node.destination,
      "url",
      registry,
      `${path}.destination`,
      urlOptions,
    ),
  );
  node.children.forEach((child, index) => {
    issues.push(
      ...validateInlineNode(
        child,
        registry,
        `${path}.children[${index}]`,
        urlOptions,
      ),
    );
  });
  return issues;
}

function validateAstNode(
  node: RichTextAstNode,
  registry: VariableRegistry,
  path: string,
  urlOptions: UrlValidationOptions,
): VisualDocumentValidationIssue[] {
  const issues: VisualDocumentValidationIssue[] = [];
  if (node.type === "paragraph") {
    node.children.forEach((child, index) => {
      issues.push(
        ...validateInlineNode(
          child,
          registry,
          `${path}.children[${index}]`,
          urlOptions,
        ),
      );
    });
    return issues;
  }
  node.children.forEach((item, itemIndex) => {
    item.children.forEach((child, childIndex) => {
      issues.push(
        ...validateInlineNode(
          child,
          registry,
          `${path}.children[${itemIndex}].children[${childIndex}]`,
          urlOptions,
        ),
      );
    });
  });
  return issues;
}

export function validateRichTextValue(
  value: RichTextValue,
  registry: VariableRegistry,
  path: string,
  urlOptions: UrlValidationOptions = {},
): VisualDocumentValidationIssue[] {
  const issues: VisualDocumentValidationIssue[] = [];
  value.children.forEach((node, index) => {
    issues.push(
      ...validateAstNode(
        node,
        registry,
        `${path}.children[${index}]`,
        urlOptions,
      ),
    );
  });
  return issues;
}
