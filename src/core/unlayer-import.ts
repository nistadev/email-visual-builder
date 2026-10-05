import type {
  EmailVisualDocument,
  RichTextInlineNode,
  RichTextValue,
  SpacingValue,
  TemplatedValue,
  TypographyValue,
  VisualDocumentValidationIssue,
  WidthValue,
} from "../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { parseVisualDocument } from "./parse-document.js";
import { DEFAULT_BUILDER_REGISTRIES } from "./registry/default-registries.js";
import type { BuilderRegistries } from "./registry/types.js";
import { err, issue } from "./result.js";
import { validateSafeUrl } from "./url.js";

type LegacyRecord = Record<string, unknown>;
type RawNode = {
  id: string;
  type: string;
  version: number;
  props: LegacyRecord;
  children?: string[];
};

export interface UnlayerEmailImportSuccess {
  ok: true;
  value: EmailVisualDocument;
  warnings: readonly string[];
}

export interface UnlayerEmailImportFailure {
  ok: false;
  issues: VisualDocumentValidationIssue[];
}

export type UnlayerEmailImportResult =
  UnlayerEmailImportSuccess | UnlayerEmailImportFailure;

const NO_SPACING: SpacingValue = {
  topPx: 0,
  rightPx: 0,
  bottomPx: 0,
  leftPx: 0,
};
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): LegacyRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function boundedText(value: unknown): string {
  return asString(value).slice(0, VISUAL_DOCUMENT_LIMITS.maxStringLength);
}

function cloneProps(value: unknown): LegacyRecord {
  if (!isRecord(value)) return {};
  return JSON.parse(JSON.stringify(value)) as LegacyRecord;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.trim().replace(/px$|%$/i, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function color(value: unknown, fallback: string | null): string | null {
  const candidate = asString(value).trim();
  return HEX_COLOR.test(candidate) ? candidate : fallback;
}

function alignment(value: unknown): "left" | "center" | "right" {
  const candidate = asString(value).toLowerCase();
  return candidate === "center" || candidate === "right" ? candidate : "left";
}

function spacing(value: unknown): SpacingValue {
  if (typeof value === "number") {
    const side = clamp(value, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
    return { topPx: side, rightPx: side, bottomPx: side, leftPx: side };
  }
  const parts = asString(value)
    .trim()
    .split(/\s+/)
    .map(parseNumber)
    .filter((part): part is number => part !== null)
    .slice(0, 4);
  if (parts.length === 0) return { ...NO_SPACING };
  const top = clamp(parts[0] ?? 0, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
  const right = clamp(parts[1] ?? top, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
  const bottom = clamp(parts[2] ?? top, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
  const left = clamp(parts[3] ?? right, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
  return { topPx: top, rightPx: right, bottomPx: bottom, leftPx: left };
}

function isNoSpacing(value: SpacingValue): boolean {
  return (
    value.topPx === 0 &&
    value.rightPx === 0 &&
    value.bottomPx === 0 &&
    value.leftPx === 0
  );
}

function width(value: unknown, fallback: WidthValue): WidthValue {
  if (typeof value === "string" && value.trim().endsWith("%")) {
    const percent = parseNumber(value);
    return percent === null
      ? fallback
      : { unit: "percent", value: clamp(percent, 0, 100) };
  }
  const pixels = parseNumber(value);
  return pixels === null
    ? fallback
    : {
        unit: "px",
        value: clamp(pixels, 0, VISUAL_DOCUMENT_LIMITS.maxDimensionPx),
      };
}

function fontFamily(value: unknown, fallback: string): string {
  const record = asRecord(value);
  const candidate = boundedText(record.value ?? value).trim();
  return candidate || fallback;
}

function fontWeight(value: unknown): TypographyValue["fontWeight"] {
  const numeric = parseNumber(isRecord(value) ? value.value : value);
  if (numeric !== null) {
    if (numeric >= 700) return "bold";
    if (numeric >= 600) return "semibold";
    if (numeric <= 300) return "thin";
  }
  const candidate = asString(
    isRecord(value) ? value.value : value,
  ).toLowerCase();
  return candidate === "bold" ||
    candidate === "semibold" ||
    candidate === "thin"
    ? candidate
    : "normal";
}

function typography(
  values: LegacyRecord,
  fallback: TypographyValue,
): TypographyValue {
  const lineHeight = parseNumber(values.lineHeight);
  const normalizedLineHeight =
    lineHeight === null
      ? fallback.lineHeightPercent
      : lineHeight <= 10
        ? lineHeight * 100
        : lineHeight;
  return {
    fontFamily: fontFamily(values.fontFamily, fallback.fontFamily),
    fontSizePx: clamp(
      parseNumber(values.fontSize) ?? fallback.fontSizePx,
      1,
      200,
    ),
    lineHeightPercent: clamp(normalizedLineHeight, 50, 400),
    letterSpacingPx: clamp(
      parseNumber(values.letterSpacing) ?? fallback.letterSpacingPx,
      -10,
      50,
    ),
    fontWeight: fontWeight(values.fontWeight ?? fallback.fontWeight),
    color: color(values.color, fallback.color) ?? fallback.color,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, entity: string) => {
      const codePoint =
        entity[0]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(1), 16)
          : Number.parseInt(entity, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    });
}

function hrefFromTag(tag: string): string | null {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  const href = match?.[1] ?? match?.[2] ?? match?.[3];
  return href ? decodeHtml(href) : null;
}

function variablesInText(
  text: string,
  registries: BuilderRegistries,
): RichTextInlineNode[] {
  const definitions = registries.variables
    .list()
    .filter((definition) => definition.token.length > 0)
    .sort((left, right) => right.token.length - left.token.length);
  if (definitions.length === 0) return [{ type: "text", text, marks: [] }];

  const nodes: RichTextInlineNode[] = [];
  let position = 0;
  while (position < text.length) {
    let match: (typeof definitions)[number] | null = null;
    let matchIndex = Number.POSITIVE_INFINITY;
    for (const definition of definitions) {
      const index = text.indexOf(definition.token, position);
      if (index >= 0 && index < matchIndex) {
        match = definition;
        matchIndex = index;
      }
    }
    if (!match) {
      if (position < text.length) {
        nodes.push({ type: "text", text: text.slice(position), marks: [] });
      }
      break;
    }
    if (matchIndex > position) {
      nodes.push({
        type: "text",
        text: text.slice(position, matchIndex),
        marks: [],
      });
    }
    nodes.push({
      type: "variable",
      variableKey: match.key,
      token: match.token,
    });
    position = matchIndex + match.token.length;
  }
  return nodes;
}

function marksFromSerializedFormat(
  value: unknown,
): ("bold" | "italic" | "underline" | "strikethrough")[] {
  const format = typeof value === "number" ? value : 0;
  const marks: ("bold" | "italic" | "underline" | "strikethrough")[] = [];
  if (format & 1) marks.push("bold");
  if (format & 2) marks.push("italic");
  if (format & 8) marks.push("underline");
  if (format & 4) marks.push("strikethrough");
  return marks;
}

function serializedInlineNodes(
  value: unknown,
  registries: BuilderRegistries,
): RichTextInlineNode[] {
  const node = asRecord(value);
  const type = asString(node.type).toLowerCase();
  if (type === "linebreak" || type === "break") return [{ type: "break" }];

  const text = asString(node.text);
  if (text) {
    const marks = marksFromSerializedFormat(node.format);
    return variablesInText(text, registries).map((inline) =>
      inline.type === "text" ? { ...inline, marks } : inline,
    );
  }
  return asArray(node.children).flatMap((child) =>
    serializedInlineNodes(child, registries),
  );
}

/** Unlayer often serializes visual spacing as `<p>&nbsp;</p>` or `<p><br></p>`.
 * Those paragraphs render as full-height lines in the visual builder, so only
 * retain paragraphs and list items that contain text, a variable, or a link
 * with meaningful content. Breaks inside an otherwise meaningful paragraph
 * are intentionally preserved. */
function hasVisibleText(text: string): boolean {
  return text.replace(/[\s\u200b-\u200d\ufeff]/g, "").length > 0;
}

function hasVisibleInlineContent(
  nodes: readonly RichTextInlineNode[],
): boolean {
  return nodes.some((node) => {
    if (node.type === "text") return hasVisibleText(node.text);
    if (node.type === "variable") return true;
    if (node.type === "link") return hasVisibleInlineContent(node.children);
    return false;
  });
}

function trimParagraphEdges(
  nodes: readonly RichTextInlineNode[],
): RichTextInlineNode[] {
  const trimmed = [...nodes];
  const isEmptyLine = (node: RichTextInlineNode | undefined): boolean =>
    node?.type === "break" ||
    (node?.type === "text" && !hasVisibleText(node.text));

  while (isEmptyLine(trimmed[0])) trimmed.shift();
  while (isEmptyLine(trimmed.at(-1))) trimmed.pop();

  const first = trimmed[0];
  if (first?.type === "text") {
    first.text = first.text.replace(/^[\s\u200b-\u200d\ufeff]+/, "");
  }
  const last = trimmed.at(-1);
  if (last?.type === "text") {
    last.text = last.text.replace(/[\s\u200b-\u200d\ufeff]+$/, "");
  }
  return trimmed;
}

function hasVisibleRichTextContent(value: RichTextValue): boolean {
  return value.children.some((node) => {
    if (node.type === "paragraph")
      return hasVisibleInlineContent(node.children);
    return node.children.some((item) => hasVisibleInlineContent(item.children));
  });
}

/**
 * Some Unlayer tools store labels as a serialized Lexical-compatible editor
 * state rather than HTML. Decode that narrow shape so the JSON is not shown
 * literally in the imported email.
 */
function serializedEditorStateRichText(
  value: unknown,
  registries: BuilderRegistries,
): RichTextValue | null {
  const source = asString(value).trim();
  if (!source.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  const root = asRecord(asRecord(parsed).root);
  if (asString(root.type).toLowerCase() !== "root") return null;

  const children: RichTextValue["children"] = [];
  for (const child of asArray(root.children)) {
    const node = asRecord(child);
    if (!asString(node.type).toLowerCase().includes("paragraph")) continue;
    const inline = trimParagraphEdges(serializedInlineNodes(node, registries));
    if (hasVisibleInlineContent(inline)) {
      children.push({ type: "paragraph", align: "left", children: inline });
    }
  }
  return {
    kind: "donativus.rich-text",
    version: 1,
    children:
      children.length > 0
        ? children
        : [{ type: "paragraph", align: "left", children: [] }],
  };
}

function richText(
  value: unknown,
  registries: BuilderRegistries,
  warnings: string[],
): RichTextValue {
  const serialized = serializedEditorStateRichText(value, registries);
  if (serialized) return serialized;
  const source = boundedText(value).slice(0, 100_000);
  const paragraphs: RichTextValue["children"] = [];
  let inline: RichTextInlineNode[] = [];
  let activeList: Extract<
    RichTextValue["children"][number],
    { type: "bulleted-list" | "numbered-list" }
  > | null = null;
  let listItem: RichTextInlineNode[] | null = null;
  let activeLink: string | null = null;
  const marks = new Set<"bold" | "italic" | "underline" | "strikethrough">();

  const appendInline = (nodes: RichTextInlineNode[]) => {
    const styled = nodes.map((node) =>
      node.type === "text" ? { ...node, marks: [...marks] } : node,
    );
    const target = listItem ?? inline;
    if (activeLink) {
      const last = target[target.length - 1];
      const sameLink =
        last?.type === "link" &&
        last.destination.segments[0]?.kind === "literal" &&
        last.destination.segments[0].value === activeLink;
      if (sameLink && last?.type === "link") {
        last.children.push(
          ...styled.filter(
            (
              node,
            ): node is Exclude<
              RichTextInlineNode,
              { type: "break" } | { type: "link" }
            > => node.type === "text" || node.type === "variable",
          ),
        );
      } else {
        target.push({
          type: "link",
          destination: { segments: [{ kind: "literal", value: activeLink }] },
          children: styled.filter(
            (
              node,
            ): node is Exclude<
              RichTextInlineNode,
              { type: "break" } | { type: "link" }
            > => node.type === "text" || node.type === "variable",
          ),
        });
      }
      return;
    }
    target.push(...styled);
  };

  const finishParagraph = () => {
    const trimmedInline = trimParagraphEdges(inline);
    if (hasVisibleInlineContent(trimmedInline)) {
      paragraphs.push({
        type: "paragraph",
        align: "left",
        children: trimmedInline,
      });
    }
    inline = [];
  };
  const finishListItem = () => {
    const trimmedItem = listItem ? trimParagraphEdges(listItem) : null;
    if (activeList && trimmedItem && hasVisibleInlineContent(trimmedItem)) {
      activeList.children.push({ type: "list-item", children: trimmedItem });
    }
    listItem = null;
  };
  const finishList = () => {
    finishListItem();
    if (activeList && activeList.children.length > 0)
      paragraphs.push(activeList);
    activeList = null;
  };

  for (const token of source.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (!token.startsWith("<")) {
      const text = decodeHtml(token);
      if (text) appendInline(variablesInText(text, registries));
      continue;
    }
    const closing = /^<\s*\//.test(token);
    const tag = /^<\s*\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (tag === "br") {
      (listItem ?? inline).push({ type: "break" });
      continue;
    }
    if (tag === "a") {
      if (closing) {
        activeLink = null;
      } else {
        const href = hrefFromTag(token);
        const safeHref = href ? validateSafeUrl(href, "legacy link") : null;
        activeLink = safeHref?.ok ? safeHref.value : null;
        if (href && !safeHref?.ok) {
          warnings.push("An unsafe legacy link was removed during import.");
        }
      }
      continue;
    }
    const mark =
      tag === "strong" || tag === "b"
        ? "bold"
        : tag === "em" || tag === "i"
          ? "italic"
          : tag === "u"
            ? "underline"
            : tag === "s" || tag === "strike" || tag === "del"
              ? "strikethrough"
              : null;
    if (mark) {
      if (closing) marks.delete(mark);
      else marks.add(mark);
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      if (closing) finishList();
      else {
        finishParagraph();
        activeList = {
          type: tag === "ul" ? "bulleted-list" : "numbered-list",
          children: [],
        };
      }
      continue;
    }
    if (tag === "li") {
      if (closing) finishListItem();
      else {
        finishParagraph();
        finishListItem();
        listItem = [];
      }
      continue;
    }
    if (["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      if (closing) finishParagraph();
    }
  }
  finishParagraph();
  finishList();
  return {
    kind: "donativus.rich-text",
    version: 1,
    children:
      paragraphs.length > 0
        ? paragraphs
        : [{ type: "paragraph", align: "left", children: [] }],
  };
}

function destination(value: unknown, warnings: string[]): TemplatedValue {
  const href = boundedText(value).trim();
  if (!href) return { segments: [] };
  const safeHref = validateSafeUrl(href, "legacy link");
  if (!safeHref.ok) {
    warnings.push("An unsafe legacy link was removed during import.");
    return { segments: [] };
  }
  return { segments: [{ kind: "literal", value: safeHref.value }] };
}

function imageAsset(
  values: LegacyRecord,
  warnings: string[],
): LegacyRecord | null {
  const source = asRecord(values.src);
  const url = boundedText(source.url).trim();
  if (!url) return null;
  const safeUrl = validateSafeUrl(url, "legacy image URL");
  if (!safeUrl.ok) {
    warnings.push("An unsafe legacy image URL was removed during import.");
    return null;
  }
  const pathname = safeUrl.value.split(/[?#]/, 1)[0] ?? "";
  const filename = pathname.split("/").pop() || "image";
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "png"
        ? "image/png"
        : extension === "gif"
          ? "image/gif"
          : extension === "webp"
            ? "image/webp"
            : "image/*";
  const asset: LegacyRecord = { url: safeUrl.value, filename, mimeType };
  const widthPx = parseNumber(source.width);
  const heightPx = parseNumber(source.height);
  if (widthPx !== null)
    asset.widthPx = clamp(widthPx, 0, VISUAL_DOCUMENT_LIMITS.maxDimensionPx);
  if (heightPx !== null)
    asset.heightPx = clamp(heightPx, 0, VISUAL_DOCUMENT_LIMITS.maxDimensionPx);
  return asset;
}

/**
 * Unlayer stores a link twice: `attrs.href` holds its own rendering
 * placeholders (`{{href}}`, `{{target}}`) while `values.href` holds the URL
 * the author actually entered. Reading `attrs` first yields the placeholder
 * for every real link, which then fails URL validation and is dropped — the
 * import "succeeds" with every button and link in the newsletter stripped.
 */
/**
 * Unlayer's legacy social block names icons by their display label
 * ("Instagram", "TikTok", …), not a stable key. Maps the common labels
 * (and a few known synonyms — "Twitter" predates the X rebrand, "Web"/
 * "Link" for the generic site icon) onto our built-in platform set;
 * anything unrecognized is dropped with a warning rather than guessed at.
 */
const LEGACY_SOCIAL_PLATFORM_BY_NAME: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  twitter: "x",
  x: "x",
  linkedin: "linkedin",
  youtube: "youtube",
  tiktok: "tiktok",
  pinterest: "pinterest",
  whatsapp: "whatsapp",
  website: "website",
  web: "website",
  link: "website",
  email: "email",
  mail: "email",
};

function legacySocialPlatform(name: unknown): string | null {
  const key = asString(name).trim().toLowerCase();
  return LEGACY_SOCIAL_PLATFORM_BY_NAME[key] ?? null;
}

/** Unlayer icon-type keys are `${shape}-${tone}` (e.g. `circle-white`, `square-color`); `tone === "color"` is the only one that means "full brand-color glyph", everything else is a mono glyph over a shape. */
function legacySocialIconStyle(iconType: unknown): "logo" | "filled" {
  return asString(iconType).toLowerCase().includes("color") ? "logo" : "filled";
}

function legacySocialShape(iconType: unknown): "circle" | "square" | "rounded" {
  const key = asString(iconType).toLowerCase();
  if (key.includes("square")) return "square";
  if (key.includes("rounded")) return "rounded";
  return "circle";
}

function actionHref(value: unknown): string {
  const action = asRecord(value);
  const authored = boundedText(asRecord(action.values).href).trim();
  return authored || boundedText(asRecord(action.attrs).href).trim();
}

/**
 * Converts the supported subset of Unlayer's persisted email design into a
 * canonical email document. It never carries arbitrary HTML or CSS
 * into the new document; unsupported tools are reported to the caller.
 */
export function importUnlayerEmailDesign(
  input: unknown,
  registries: BuilderRegistries = DEFAULT_BUILDER_REGISTRIES,
): UnlayerEmailImportResult {
  const design = asRecord(input);
  const body = asRecord(design.body);
  const bodyValues = asRecord(body.values);
  if (!isRecord(design.body) || !Array.isArray(body.rows)) {
    return err([
      issue(
        "unlayer/import-invalid-design",
        "The legacy template does not contain an importable Unlayer email design.",
      ),
    ]);
  }

  const warnings: string[] = [];
  const nodes: Record<string, RawNode> = {};
  let nodeCount = 0;

  const createNode = (
    type: string,
    props: LegacyRecord,
    children?: string[],
  ): string | null => {
    if (nodeCount >= VISUAL_DOCUMENT_LIMITS.maxNodeCount) {
      warnings.push(
        "The legacy template exceeded the new editor's node limit; remaining content was not imported.",
      );
      return null;
    }
    const definition = registries.blocks.get(type);
    if (!definition) {
      warnings.push(
        `The new editor does not support the "${type}" block type.`,
      );
      return null;
    }
    const id = `unlayer-${type}-${nodeCount + 1}`;
    nodeCount += 1;
    nodes[id] = {
      id,
      type,
      version: definition.version,
      props,
      ...(children ? { children } : {}),
    };
    return id;
  };

  const defaultProps = (type: string): LegacyRecord => {
    const definition = registries.blocks.get(type);
    return cloneProps(definition?.defaultProps("email"));
  };

  const contentNode = (content: LegacyRecord): string | null => {
    const type = asString(content.type).toLowerCase();
    const values = asRecord(content.values);
    const contentSpacing = spacing(values.containerPadding);
    if (type === "text" || type === "paragraph") {
      const props = defaultProps("rich-text");
      // Newer Unlayer persists body copy as a serialized Lexical state in
      // `textJson` and leaves `text` unset; reading only `text` imported the
      // paragraph's styling and dropped every word of it. Heading and button
      // already read both — this branch was the one that did not.
      const value = richText(
        values.text ?? values.textJson,
        registries,
        warnings,
      );
      if (!hasVisibleRichTextContent(value)) return null;
      props.value = value;
      props.typography = typography(
        values,
        asRecord(props.typography) as unknown as TypographyValue,
      );
      props.spacing = contentSpacing;
      return createNode("rich-text", props);
    }
    if (type === "heading") {
      const props = defaultProps("heading");
      props.level =
        Number.parseInt(asString(values.headingType).slice(1), 10) || 2;
      const text = richText(
        values.text ?? values.textJson,
        registries,
        warnings,
      );
      if (!hasVisibleRichTextContent(text)) return null;
      props.text = text;
      props.typography = typography(
        values,
        asRecord(props.typography) as unknown as TypographyValue,
      );
      props.spacing = contentSpacing;
      props.align = alignment(values.textAlign);
      return createNode("heading", props);
    }
    if (type === "image") {
      const props = defaultProps("image");
      props.asset = imageAsset(values, warnings);
      props.altText = boundedText(values.altText);
      props.align = alignment(values.textAlign);
      props.spacing = contentSpacing;
      const source = asRecord(values.src);
      props.displayWidth = width(source.maxWidth ?? source.width, {
        unit: "percent",
        value: 100,
      });
      const href = actionHref(values.action);
      if (href) props.link = destination(href, warnings);
      return createNode("image", props);
    }
    if (type === "button") {
      const props = defaultProps("cta");
      const label = richText(
        values.text ?? values.textJson,
        registries,
        warnings,
      );
      if (!hasVisibleRichTextContent(label)) return null;
      props.label = label;
      props.destination = destination(actionHref(values.href), warnings);
      props.typography = typography(
        values,
        asRecord(props.typography) as unknown as TypographyValue,
      );
      props.backgroundColor =
        color(asRecord(values.buttonColors).backgroundColor, "#000000") ??
        "#000000";
      props.align = alignment(values.textAlign);
      props.width = asRecord(values.size).autoWidth
        ? { unit: "auto" }
        : width(asRecord(values.size).width, { unit: "percent", value: 100 });
      props.borderRadiusPx = clamp(
        parseNumber(values.borderRadius) ?? 0,
        0,
        VISUAL_DOCUMENT_LIMITS.maxBorderRadiusPx,
      );
      props.spacing = spacing(values.padding);
      return createNode("cta", props);
    }
    if (type === "divider") {
      const props = defaultProps("divider");
      const border = asRecord(values.border);
      props.color = color(border.borderTopColor, "#cccccc") ?? "#cccccc";
      props.thicknessPx = clamp(parseNumber(border.borderTopWidth) ?? 1, 1, 20);
      props.style = ["solid", "dashed", "dotted"].includes(
        asString(border.borderTopStyle),
      )
        ? border.borderTopStyle
        : "solid";
      props.width = width(values.width, { unit: "percent", value: 100 });
      props.align = alignment(values.textAlign);
      props.spacing = contentSpacing;
      return createNode("divider", props);
    }
    if (type === "social") {
      const iconsBlock = asRecord(values.icons);
      const items = asArray(iconsBlock.icons)
        .map(asRecord)
        .map((icon, index) => {
          const platform = legacySocialPlatform(icon.name);
          if (!platform) {
            warnings.push(
              `The legacy social icon "${asString(icon.name) || "unknown"}" has no equivalent in the new editor and was skipped.`,
            );
            return null;
          }
          const href = boundedText(icon.url).trim();
          const safeHref = href ? validateSafeUrl(href, "legacy social link") : null;
          if (href && !safeHref?.ok) {
            warnings.push("An unsafe legacy social link was removed during import.");
          }
          return {
            id: `unlayer-social-item-${index + 1}`,
            platform,
            url: safeHref?.ok ? safeHref.value : "",
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, VISUAL_DOCUMENT_LIMITS.maxSocialItems);
      if (items.length === 0) return null;
      const props = defaultProps("social");
      props.items = items;
      props.iconStyle = legacySocialIconStyle(iconsBlock.iconType);
      props.shape = legacySocialShape(iconsBlock.iconType);
      props.iconSizePx = clamp(parseNumber(values.iconSize) ?? 32, 12, 96);
      props.gapPx = clamp(parseNumber(values.spacing) ?? 8, 0, VISUAL_DOCUMENT_LIMITS.maxSpacingPx);
      props.align = alignment(values.align);
      props.spacing = contentSpacing;
      return createNode("social", props);
    }
    if (type === "page_break" || type === "spacer") {
      const props = defaultProps("spacer");
      props.heightPx = clamp(
        parseNumber(values.height) ?? 16,
        0,
        VISUAL_DOCUMENT_LIMITS.maxDimensionPx,
      );
      props.margin = contentSpacing;
      return createNode("spacer", props);
    }

    const fallbackText = asString(values.text ?? values.html).trim();
    warnings.push(
      `The legacy "${type || "unknown"}" block was flattened because it has no equivalent in the new editor.`,
    );
    if (!fallbackText) return null;
    const props = defaultProps("rich-text");
    const value = richText(fallbackText, registries, warnings);
    if (!hasVisibleRichTextContent(value)) return null;
    props.value = value;
    props.spacing = contentSpacing;
    return createNode("rich-text", props);
  };

  const sectionPropsForRow = (rowValues: LegacyRecord): LegacyRecord => {
    const sectionProps = defaultProps("section");
    sectionProps.background = {
      color: color(
        rowValues.columnsBackgroundColor,
        color(rowValues.backgroundColor, "#ffffff"),
      ),
    };
    sectionProps.contentWidth = width(bodyValues.contentWidth, {
      unit: "px",
      value: 600,
    });
    sectionProps.spacing = spacing(rowValues.padding);
    sectionProps.align = alignment(bodyValues.contentAlign);
    return sectionProps;
  };

  let previousSimpleSection: { id: string; presentation: string } | null = null;

  const importRow = (rawRow: unknown): string[] => {
    const row = asRecord(rawRow);
    const rowValues = asRecord(row.values);
    const rawColumns = asArray(row.columns);
    if (rawColumns.length === 0) {
      warnings.push("An empty legacy row was skipped during import.");
      return [];
    }

    // The editor already permits leaf blocks directly within a section. Keep
    // a column wrapper only when it carries visual styling that would be lost.
    if (rawColumns.length === 1) {
      const column = asRecord(rawColumns[0]);
      const columnValues = asRecord(column.values);
      const columnBackground = color(columnValues.backgroundColor, null);
      const columnSpacing = spacing(columnValues.padding);
      if (columnBackground === null && isNoSpacing(columnSpacing)) {
        const childIds = asArray(column.contents)
          .map(asRecord)
          .map(contentNode)
          .filter((id): id is string => id !== null);
        const sectionProps = sectionPropsForRow(rowValues);
        const presentation = JSON.stringify(sectionProps);

        if (
          childIds.length > 0 &&
          previousSimpleSection?.presentation === presentation
        ) {
          const section = nodes[previousSimpleSection.id];
          if (section?.children) {
            section.children.push(...childIds);
            return [];
          }
        }

        const sectionId = createNode("section", sectionProps, childIds);
        previousSimpleSection =
          sectionId && childIds.length > 0
            ? { id: sectionId, presentation }
            : null;
        return sectionId ? [sectionId] : [];
      }
    }

    previousSimpleSection = null;
    const sectionIds: string[] = [];
    for (let start = 0; start < rawColumns.length; start += 4) {
      const columns = rawColumns.slice(start, start + 4).map(asRecord);
      if (start > 0) {
        warnings.push(
          "A legacy row with more than four columns was split into multiple sections.",
        );
      }
      const columnIds: string[] = [];
      for (const rawColumn of columns) {
        const column = asRecord(rawColumn);
        const columnValues = asRecord(column.values);
        const childIds = asArray(column.contents)
          .map(asRecord)
          .map(contentNode)
          .filter((id): id is string => id !== null);
        const props = defaultProps("column");
        props.background = { color: color(columnValues.backgroundColor, null) };
        props.spacing = spacing(columnValues.padding);
        const columnId = createNode("column", props, childIds);
        if (columnId) columnIds.push(columnId);
      }
      if (columnIds.length === 0) continue;
      const cells = asArray(row.cells).slice(start, start + columnIds.length);
      const rawRatios = cells.map(parseNumber);
      const total = rawRatios.reduce<number>(
        (sum, item) => sum + (item && item > 0 ? item : 0),
        0,
      );
      const ratios =
        total > 0
          ? rawRatios.map((item) =>
              Math.round(((item && item > 0 ? item : 0) / total) * 100),
            )
          : columnIds.map(() => Math.floor(100 / columnIds.length));
      ratios[ratios.length - 1] =
        100 - ratios.slice(0, -1).reduce((sum, item) => sum + item, 0);
      const columnsProps = defaultProps("columns");
      columnsProps.columnWidthRatios = ratios;
      columnsProps.responsiveStack =
        rowValues.noStackMobile === true ? "no-stack" : "stack";
      const columnsId = createNode("columns", columnsProps, columnIds);
      if (!columnsId) continue;

      const sectionId = createNode("section", sectionPropsForRow(rowValues), [
        columnsId,
      ]);
      if (sectionId) sectionIds.push(sectionId);
    }
    return sectionIds;
  };

  const rootProps = defaultProps("document-root");
  const rootId = createNode("document-root", rootProps, []);
  if (!rootId) {
    return err([
      issue(
        "unlayer/import-missing-root",
        "The new editor root block is unavailable.",
      ),
    ]);
  }
  const root = nodes[rootId];
  if (!root?.children) {
    return err([
      issue(
        "unlayer/import-missing-root",
        "The imported document root is invalid.",
      ),
    ]);
  }
  for (const row of [
    ...asArray(body.headers),
    ...asArray(body.rows),
    ...asArray(body.footers),
  ]) {
    root.children.push(...importRow(row));
  }
  if (root.children.length === 0) {
    const sectionId = createNode("section", defaultProps("section"), []);
    if (sectionId) root.children.push(sectionId);
  }

  const defaultSettings = cloneProps(
    registries.modes.get("email")?.defaultSettings,
  );
  defaultSettings.language = boundedText(bodyValues.language).trim() || "en";
  defaultSettings.previewText = boundedText(bodyValues.preheaderText);
  defaultSettings.canvasBackgroundColor =
    color(bodyValues.backgroundColor, "#f4f4f4") ?? "#f4f4f4";
  defaultSettings.contentWidth = width(bodyValues.contentWidth, {
    unit: "px",
    value: 600,
  });
  defaultSettings.contentAlign = alignment(bodyValues.contentAlign);
  defaultSettings.defaultTypography = typography(
    bodyValues,
    asRecord(defaultSettings.defaultTypography) as unknown as TypographyValue,
  );
  defaultSettings.textColor =
    color(bodyValues.textColor, "#333333") ?? "#333333";
  const linkStyle = asRecord(bodyValues.linkStyle);
  defaultSettings.linkStyle = {
    color: color(linkStyle.linkColor, "#1a73e8") ?? "#1a73e8",
    underline: linkStyle.linkUnderline !== false,
  };

  const parsed = parseVisualDocument(
    {
      kind: "donativus.visual-document",
      schemaVersion: 1,
      mode: "email",
      rootId,
      nodes,
      settings: defaultSettings,
    },
    registries,
  );
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value as EmailVisualDocument, warnings };
}
