import type { CtaNode, VisualDocumentLinkStyle } from "../../../types/index.js";
import { escapeHtmlAttribute, serializeInlineStyle } from "../../escape.js";
import {
  marginStyleEntries,
  shadowStyleEntries,
  spacingStyleEntries,
  typographyStyleEntries,
} from "../../style.js";
import { renderTemplatedValueAsText } from "../../templated-text.js";
import { renderRichTextInlineHtml } from "../rich-text-html.js";
import { externalLinkAttributes } from "../external-link.js";

/** A CTA to an externally-hosted form is an ordinary styled link — landing pages never embed a `<form>` (design.md decision #12). */
export function renderLandingCta(
  node: CtaNode,
  linkStyle: VisualDocumentLinkStyle,
): string {
  const {
    label,
    destination,
    typography,
    backgroundColor,
    align,
    width,
    borderRadiusPx,
    spacing,
    margin,
    shadow,
  } = node.props;

  const href = renderTemplatedValueAsText(destination, escapeHtmlAttribute);
  const labelHtml = renderRichTextInlineHtml(label, linkStyle, false);
  const widthStyle =
    width.unit === "auto"
      ? null
      : width.unit === "px"
        ? `${width.value}px`
        : `${width.value}%`;

  const style = serializeInlineStyle([
    ...typographyStyleEntries(typography),
    ["display", "inline-block"],
    ...spacingStyleEntries(spacing),
    ["background-color", backgroundColor],
    ["border-radius", `${borderRadiusPx}px`],
    ["text-decoration", "none"],
    ["text-align", "center"],
    ["width", widthStyle],
    ...marginStyleEntries(margin),
    ...shadowStyleEntries(shadow),
  ]);

  const button = `<a href="${href}" style="${style}"${externalLinkAttributes(href)}>${labelHtml || "&nbsp;"}</a>`;
  const wrapperStyle = serializeInlineStyle([["text-align", align]]);
  return `<div style="${wrapperStyle}">${button}</div>`;
}
