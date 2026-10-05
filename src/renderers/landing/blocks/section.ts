import type { LandingPageVisualDocument, SectionNode } from "../../../types/index.js";
import { serializeInlineStyle } from "../../escape.js";
import {
  backgroundStyleEntries,
  marginStyleEntries,
  shadowStyleEntries,
  spacingStyleEntries,
} from "../../style.js";
import type { RendererContext } from "../../traversal.js";
import { renderLandingNode } from "../render-node.js";

export function renderLandingSection(
  node: SectionNode,
  document: LandingPageVisualDocument,
  context: RendererContext,
): string {
  const { background, contentWidth, spacing, margin, align, shadow } =
    node.props;
  const childrenHtml = (node.children ?? [])
    .map((childId) => renderLandingNode(childId, document, context))
    .join("");

  const sectionStyle = serializeInlineStyle([
    ...backgroundStyleEntries(background),
    ...marginStyleEntries(margin),
    ...shadowStyleEntries(shadow),
  ]);
  const widthValue =
    contentWidth.unit === "px"
      ? `${contentWidth.value}px`
      : `${contentWidth.value}%`;
  const margins =
    align === "center"
      ? "0 auto"
      : align === "right"
        ? "0 0 0 auto"
        : "0 auto 0 0";
  const containerStyle = serializeInlineStyle([
    ["max-width", widthValue],
    ["width", "100%"],
    ["margin", margins],
    ["text-align", align],
    ...spacingStyleEntries(spacing),
  ]);

  return `<section style="${sectionStyle}"><div style="${containerStyle}">${childrenHtml}</div></section>`;
}
