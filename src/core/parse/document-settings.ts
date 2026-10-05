import type {
  SpacingValue,
  TypographyValue,
  VisualDocumentEmailSettings,
  VisualDocumentLandingPageSettings,
  VisualDocumentLinkStyle,
  WidthValue,
} from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseBoolean,
  parseHexColor,
  parseString,
} from "../primitives.js";
import { FieldCollector, err, issue, type ParseResult } from "../result.js";
import {
  parseHorizontalAlignment,
  parseSpacing,
  parseTypography,
  parseWidth,
} from "./presentation.js";

function parseLinkStyle(
  value: unknown,
  path: string,
): ParseResult<VisualDocumentLinkStyle> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a link style object at "${path}".`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const color = collector.field(
    parseHexColor(value.color, `${path}.color`),
    "#1a73e8",
  );
  const underline = collector.field(
    parseBoolean(value.underline, `${path}.underline`),
    true,
  );
  return collector.finish({ color, underline });
}

function parseLanguage(value: unknown, path: string): ParseResult<string> {
  return parseString(value, path, { allowEmpty: false, maxLength: 35 });
}

export function parseEmailSettings(
  value: unknown,
  path: string,
): ParseResult<VisualDocumentEmailSettings> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected email settings at "${path}".`, {
        path,
      }),
    ]);
  }
  const collector = new FieldCollector();
  const language = collector.field(
    parseLanguage(value.language, `${path}.language`),
    "en",
  );
  const previewText = collector.field(
    parseString(value.previewText, `${path}.previewText`, {
      allowEmpty: true,
      maxLength: 500,
    }),
    "",
  );
  const canvasBackgroundColor = collector.field(
    parseHexColor(value.canvasBackgroundColor, `${path}.canvasBackgroundColor`),
    "#f4f4f4",
  );
  const contentWidth = collector.field<WidthValue>(
    parseWidth(value.contentWidth, `${path}.contentWidth`),
    {
      unit: "px",
      value: 600,
    },
  );
  const contentAlign =
    value.contentAlign === undefined
      ? "center"
      : collector.field(
          parseHorizontalAlignment(value.contentAlign, `${path}.contentAlign`),
          "center",
        );
  const spacing = collector.field<SpacingValue>(
    parseSpacing(value.spacing, `${path}.spacing`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  const defaultTypography = collector.field<TypographyValue>(
    parseTypography(value.defaultTypography, `${path}.defaultTypography`),
    {
      fontFamily: "sans-serif",
      fontSizePx: 16,
      lineHeightPercent: 150,
      letterSpacingPx: 0,
      fontWeight: "normal",
      color: "#333333",
    },
  );
  const textColor = collector.field(
    parseHexColor(value.textColor, `${path}.textColor`),
    "#333333",
  );
  const linkStyle = collector.field(
    parseLinkStyle(value.linkStyle, `${path}.linkStyle`),
    {
      color: "#1a73e8",
      underline: true,
    },
  );
  return collector.finish({
    language,
    previewText,
    canvasBackgroundColor,
    contentWidth,
    contentAlign,
    spacing,
    defaultTypography,
    textColor,
    linkStyle,
  });
}

export function parseLandingPageSettings(
  value: unknown,
  path: string,
): ParseResult<VisualDocumentLandingPageSettings> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected landing-page settings at "${path}".`,
        { path },
      ),
    ]);
  }
  const collector = new FieldCollector();
  const language = collector.field(
    parseLanguage(value.language, `${path}.language`),
    "en",
  );
  const title = collector.field(
    parseString(value.title, `${path}.title`, {
      allowEmpty: false,
      maxLength: 200,
    }),
    "Untitled page",
  );

  let metaDescription: string | null = null;
  if (value.metaDescription !== null && value.metaDescription !== undefined) {
    metaDescription = collector.field(
      parseString(value.metaDescription, `${path}.metaDescription`, {
        allowEmpty: true,
        maxLength: 300,
      }),
      null,
    );
  }

  const pageBackgroundColor = collector.field(
    parseHexColor(value.pageBackgroundColor, `${path}.pageBackgroundColor`),
    "#ffffff",
  );
  const contentWidth = collector.field<WidthValue>(
    parseWidth(value.contentWidth, `${path}.contentWidth`),
    {
      unit: "px",
      value: 960,
    },
  );
  const contentAlign =
    value.contentAlign === undefined
      ? "center"
      : collector.field(
          parseHorizontalAlignment(value.contentAlign, `${path}.contentAlign`),
          "center",
        );
  const spacing = collector.field<SpacingValue>(
    parseSpacing(value.spacing, `${path}.spacing`),
    { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  );
  const defaultTypography = collector.field<TypographyValue>(
    parseTypography(value.defaultTypography, `${path}.defaultTypography`),
    {
      fontFamily: "sans-serif",
      fontSizePx: 16,
      lineHeightPercent: 150,
      letterSpacingPx: 0,
      fontWeight: "normal",
      color: "#333333",
    },
  );
  const textColor = collector.field(
    parseHexColor(value.textColor, `${path}.textColor`),
    "#333333",
  );
  const linkStyle = collector.field(
    parseLinkStyle(value.linkStyle, `${path}.linkStyle`),
    {
      color: "#1a73e8",
      underline: true,
    },
  );

  let faviconUrl: string | null = null;
  if (value.faviconUrl !== null && value.faviconUrl !== undefined) {
    faviconUrl = collector.field(
      parseString(value.faviconUrl, `${path}.faviconUrl`, {
        allowEmpty: false,
        maxLength: VISUAL_DOCUMENT_LIMITS.maxStringLength,
      }),
      null,
    );
  }

  return collector.finish({
    language,
    title,
    metaDescription,
    pageBackgroundColor,
    contentWidth,
    contentAlign,
    spacing,
    defaultTypography,
    textColor,
    linkStyle,
    faviconUrl,
  });
}
