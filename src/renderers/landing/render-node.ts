// The landing-page renderer's node dispatcher — mirrors the email
// renderer's dispatch shape (design.md decision #3: two independent
// rendering paths sharing no code below this boundary). By the time this
// runs, the export pipeline has already rejected unavailable-plugin nodes
// and blocking validation errors.

import type {
  LandingPageVisualDocument,
  VisualBuilderNodeId,
} from "../../types/index.js";
import type { RendererContext } from "../traversal.js";
import { isBlockRenderer } from "../render-types.js";
import { renderLandingColumns } from "./blocks/columns.js";
import { renderLandingCta } from "./blocks/cta.js";
import { renderLandingDivider } from "./blocks/divider.js";
import { renderLandingHeading } from "./blocks/heading.js";
import { renderLandingImage } from "./blocks/image.js";
import { renderLandingRichText } from "./blocks/rich-text.js";
import { renderLandingSection } from "./blocks/section.js";
import { renderLandingSocial } from "./blocks/social.js";
import { renderLandingSpacer } from "./blocks/spacer.js";

export function renderLandingNode(
  nodeId: VisualBuilderNodeId,
  document: LandingPageVisualDocument,
  context: RendererContext,
): string {
  const node = document.nodes[nodeId];
  if (!node || "unavailable" in node) return "";

  switch (node.type) {
    case "document-root":
      return (node.children ?? [])
        .map((childId) => renderLandingNode(childId, document, context))
        .join("");
    case "section":
      return renderLandingSection(node, document, context);
    case "columns":
      return renderLandingColumns(node, document, context);
    case "column":
      // Rendered directly by `renderLandingColumns`, which owns the grid-cell structure.
      return (node.children ?? [])
        .map((childId) => renderLandingNode(childId, document, context))
        .join("");
    case "heading":
      return renderLandingHeading(node, document.settings.linkStyle);
    case "rich-text":
      return renderLandingRichText(node, document.settings.linkStyle);
    case "image":
      return renderLandingImage(node);
    case "cta":
      return renderLandingCta(node, document.settings.linkStyle);
    case "divider":
      return renderLandingDivider(node);
    case "spacer":
      return renderLandingSpacer(node);
    case "social":
      return renderLandingSocial(node);
    default: {
      // Reached only for a consumer-registered custom block — see the email dispatcher for the same pattern.
      const customNode = node as { type: string };
      const customRenderer = context.registries.blocks.get(customNode.type)
        ?.renderers?.["landing-page"];
      return isBlockRenderer(customRenderer)
        ? customRenderer(node, document, context)
        : "";
    }
  }
}
