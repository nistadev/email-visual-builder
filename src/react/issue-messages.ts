import type {
  VisualDocumentQualityWarning,
  VisualDocumentValidationIssue,
} from "../types/index.js";

type DisplayIssue =
  VisualDocumentValidationIssue | VisualDocumentQualityWarning;

const FIELD_NAMES: Record<string, string> = {
  backgroundColor: "Background color",
  borderRadiusPx: "Corner radius",
  color: "Color",
  columnWidthRatios: "Column width",
  contentWidth: "Content width",
  displayWidth: "Image width",
  fontFamily: "Font family",
  fontSizePx: "Font size",
  heightPx: "Height",
  language: "Language",
  letterSpacingPx: "Letter spacing",
  lineHeightPercent: "Line height",
  thicknessPx: "Thickness",
  value: "Value",
  width: "Width",
};

function fieldNameFromPath(path: string | undefined): string {
  const key = path?.match(/([A-Za-z][A-Za-z0-9]*)$/)?.[1];
  if (!key) return "Value";
  return (
    FIELD_NAMES[key] ??
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/Px$/, "")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

/** Converts parser-oriented diagnostics into short messages suitable for editor UI. */
export function formatIssueMessage(
  issue: DisplayIssue,
  fieldLabel?: string,
): string {
  const field = fieldLabel ?? fieldNameFromPath(issue.path);
  const minimum = issue.message.match(/must be >= (-?\d+(?:\.\d+)?)\.?$/)?.[1];
  if (issue.code === "value/number-too-small" && minimum) {
    return `${field} must be at least ${minimum}.`;
  }
  const maximum = issue.message.match(/must be <= (-?\d+(?:\.\d+)?)\.?$/)?.[1];
  if (issue.code === "value/number-too-large" && maximum) {
    return `${field} must be at most ${maximum}.`;
  }
  if (issue.code === "value/not-a-number") {
    return `Enter a valid number for ${field.toLowerCase()}.`;
  }
  if (issue.code === "value/invalid-color") {
    return `${field} must be a valid hex color.`;
  }
  if (issue.code === "value/string-empty") {
    return `${field} cannot be empty.`;
  }
  if (issue.code === "value/invalid-enum") {
    return `Choose a valid ${field.toLowerCase()}.`;
  }
  return issue.message.replace(/ at "[^"]+"/g, "");
}
