// Document-wide variable/URL validation (design.md decisions #8, #12; tasks
// 7.5-7.6). Walks every built-in node that carries a `TemplatedValue` or
// rich-text value and validates it in its actual rendering context. Relative
// and anchor destinations are only permitted in landing-page documents —
// email clients have no notion of a "current page" to resolve them against.
// Intended to be composed into the section-8 export pipeline; it is not
// wired into the controller's lightweight `validate()` here.

import type {
  VisualDocument,
  VisualDocumentValidationIssue,
} from "../../types/index.js";
import type { VariableRegistry } from "../registry/types.js";
import type { UrlValidationOptions } from "../url.js";
import { validateSafeUrl } from "../url.js";
import { validateRichTextValue } from "./validate-rich-text.js";
import { validateTemplatedValue } from "./validate-templated-value.js";

export function validateDocumentVariablesAndUrls(
  document: VisualDocument,
  registry: VariableRegistry,
): VisualDocumentValidationIssue[] {
  const urlOptions: UrlValidationOptions = {
    allowRelative: document.mode === "landing-page",
  };
  const issues: VisualDocumentValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(document.nodes)) {
    if ("unavailable" in node) continue;

    if (node.type === "heading") {
      issues.push(
        ...withNodeId(
          validateRichTextValue(node.props.text, registry, "props.text"),
          nodeId,
        ),
      );
    }
    if (node.type === "rich-text") {
      issues.push(
        ...withNodeId(
          validateRichTextValue(
            node.props.value,
            registry,
            "props.value",
            urlOptions,
          ),
          nodeId,
        ),
      );
    }
    if (node.type === "cta") {
      issues.push(
        ...withNodeId(
          validateRichTextValue(node.props.label, registry, "props.label"),
          nodeId,
        ),
      );
      issues.push(
        ...withNodeId(
          validateTemplatedValue(
            node.props.destination,
            "url",
            registry,
            "props.destination",
            urlOptions,
          ),
          nodeId,
        ),
      );
    }
    if (node.type === "image") {
      if (node.props.asset) {
        const assetUrlResult = validateSafeUrl(
          node.props.asset.url,
          "props.asset.url",
        );
        if (!assetUrlResult.ok) {
          issues.push(...withNodeId(assetUrlResult.issues, nodeId));
        }
      }
      if (node.props.link) {
        issues.push(
          ...withNodeId(
            validateTemplatedValue(
              node.props.link,
              "url",
              registry,
              "props.link",
              urlOptions,
            ),
            nodeId,
          ),
        );
      }
    }
    if (node.type === "social") {
      node.props.items.forEach((item, index) => {
        if (item.url.trim().length === 0) return;
        const result = validateSafeUrl(
          item.url,
          `props.items[${index}].url`,
          urlOptions,
        );
        if (!result.ok) issues.push(...withNodeId(result.issues, nodeId));
      });
    }
  }

  if (
    document.mode === "landing-page" &&
    document.settings.faviconUrl !== null
  ) {
    const faviconResult = validateSafeUrl(
      document.settings.faviconUrl,
      "settings.faviconUrl",
    );
    if (!faviconResult.ok) issues.push(...faviconResult.issues);
  }

  return issues;
}

function withNodeId(
  issues: VisualDocumentValidationIssue[],
  nodeId: string,
): VisualDocumentValidationIssue[] {
  return issues.map((issue) => (issue.nodeId ? issue : { ...issue, nodeId }));
}
