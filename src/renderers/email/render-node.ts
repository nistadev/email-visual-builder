// The email renderer's node dispatcher (design.md decisions #4, #11;
// task 9.2-9.3). By the time this runs, the export pipeline has already
// rejected any document containing an unavailable-plugin node or a blocking
// validation error (see `pipeline.ts`), so every node here is a known,
// valid built-in block — or, for a consumer-registered custom block, one
// whose author supplied its own email renderer through the block registry.

import type {
  EmailVisualDocument,
  VisualBuilderNodeId,
} from "../../types/index.js";
import type { RendererContext } from "../traversal.js";
import { renderEmailColumns } from "./blocks/columns.js";
import { renderEmailCta } from "./blocks/cta.js";
import { renderEmailDivider } from "./blocks/divider.js";
import { renderEmailHeading } from "./blocks/heading.js";
import { renderEmailImage } from "./blocks/image.js";
import { renderEmailRichText } from "./blocks/rich-text.js";
import { renderEmailSection } from "./blocks/section.js";
import { renderEmailSocial } from "./blocks/social.js";
import { renderEmailSpacer } from "./blocks/spacer.js";
import { isBlockRenderer } from "../render-types.js";

export function renderEmailNode(
  nodeId: VisualBuilderNodeId,
  document: EmailVisualDocument,
  context: RendererContext,
): string {
  const node = document.nodes[nodeId];
  if (!node || "unavailable" in node) return "";

  switch (node.type) {
    case "document-root":
      return (node.children ?? [])
        .map((childId) => renderEmailNode(childId, document, context))
        .join("");
    case "section":
      return renderEmailSection(node, document, context);
    case "columns":
      return renderEmailColumns(node, document, context);
    case "column":
      // Rendered directly by `renderEmailColumns`, which owns column `<td>` structure.
      return (node.children ?? [])
        .map((childId) => renderEmailNode(childId, document, context))
        .join("");
    case "heading":
      return renderEmailHeading(node, document.settings.linkStyle);
    case "rich-text":
      return renderEmailRichText(node, document.settings.linkStyle);
    case "image":
      return renderEmailImage(node);
    case "cta":
      return renderEmailCta(node, document.settings.linkStyle);
    case "divider":
      return renderEmailDivider(node);
    case "spacer":
      return renderEmailSpacer(node);
    case "social":
      return renderEmailSocial(node, context.emailAssetBaseUrl);
    default: {
      // Reached only for a consumer-registered custom block type — `VisualBuilderNode` statically
      // enumerates just the built-ins above, but a plugin's parsed node still flows through here at
      // runtime with whatever `type` it registered.
      const customNode = node as { type: string };
      const customRenderer = context.registries.blocks.get(customNode.type)
        ?.renderers?.email;
      // Defensive fallback only — the pipeline blocks export before a block with no registered
      // email renderer could reach here.
      return isBlockRenderer(customRenderer)
        ? customRenderer(node, document, context)
        : "";
    }
  }
}
