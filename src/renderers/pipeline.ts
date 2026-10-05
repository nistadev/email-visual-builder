// The parse-migrate-validate-check-serialize-render export pipeline
// (design.md decision #10, tasks 8.3-8.4). Runs entirely on raw `unknown`
// input plus a registry set, so both the live controller (passing its
// in-memory document, which is valid `unknown` input) and a non-React
// caller like the API (passing untrusted persisted/submitted JSON) share
// exactly one code path from parse through render.
//
// Layering: this lives under `renderers`, not `core` — it is the one place
// permitted to call a mode's HTML renderer, which `core` must never import
// (design.md decision #1). `BuilderController.export()` intentionally stays
// core-only and always returns `html: null`; a consumer that needs rendered
// HTML calls `exportVisualDocument` here instead.

import type {
  VisualDocument,
  VisualDocumentExportResult,
  VisualDocumentMode,
} from "../types/index.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import { collectBlockDefinedQualityWarnings } from "../core/block-quality-checks.js";
import { VISUAL_DOCUMENT_LIMITS } from "../core/limits.js";
import { parseVisualDocument } from "../core/parse-document.js";
import { issue } from "../core/result.js";
import { serializeVisualDocument } from "../core/serialize.js";
import { collectUnavailableNodeIssues } from "../core/unavailable-nodes.js";
import { validateBlockConstraints } from "../core/validate-block-constraints.js";
import {
  collectLinkQualityWarnings,
  collectUnsubscribeLinkWarning,
} from "../core/variables/document-quality-checks.js";
import { validateDocumentVariablesAndUrls } from "../core/variables/validate-document.js";
import { isModeRenderer } from "./render-types.js";
import { DEFAULT_RENDERER_REGISTRIES } from "./registries.js";
import { createSamplePreviewDocument } from "./sample-values.js";

export interface VisualDocumentExportOptions {
  /** Render text-variable sample values into HTML only; the returned document and JSON remain canonical tokens. */
  variablePreviewMode?: "token" | "sample";
  /** Public origin for email assets that mail clients cannot load from data URIs. */
  emailAssetBaseUrl?: string;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function getModeRenderer(
  mode: VisualDocumentMode,
  registries: BuilderRegistries,
) {
  const renderer = registries.modes.get(mode)?.renderer;
  return isModeRenderer(renderer) ? renderer : undefined;
}

/**
 * Runs the full pipeline: migrate + parse + tree-invariant validation
 * (`parseVisualDocument`), block-constraint/unavailable-node/variable-and-URL
 * validation, mode/block quality checks, deterministic canonical
 * serialization, and — only when no blocking error exists — HTML rendering
 * through the document's mode renderer. Identical `input`/`registries`
 * always produce byte-identical `json`/`html` (decision #10): every step is
 * a pure function of the parsed document and the registries, with no clock,
 * randomness, or DOM read anywhere in the chain.
 */
export function exportVisualDocument(
  input: unknown,
  registries: BuilderRegistries = DEFAULT_RENDERER_REGISTRIES,
  options: VisualDocumentExportOptions = {},
): VisualDocumentExportResult {
  const parseResult = parseVisualDocument(input, registries);
  if (!parseResult.ok) {
    return {
      document: null,
      json: null,
      html: null,
      errors: parseResult.issues,
      warnings: [],
    };
  }
  const document: VisualDocument = parseResult.value;

  const errors = [
    ...collectUnavailableNodeIssues(document),
    ...validateBlockConstraints(document, registries),
    ...validateDocumentVariablesAndUrls(document, registries.variables),
  ];
  const warnings = [
    ...collectLinkQualityWarnings(document),
    ...collectUnsubscribeLinkWarning(document, registries.variables),
    ...collectBlockDefinedQualityWarnings(document, registries),
  ];

  const json = serializeVisualDocument(document);
  if (utf8ByteLength(json) > VISUAL_DOCUMENT_LIMITS.maxCanonicalJsonBytes) {
    errors.push(
      issue(
        "document/json-too-large",
        `Canonical JSON is ${utf8ByteLength(json)} bytes, exceeding the maximum of ${VISUAL_DOCUMENT_LIMITS.maxCanonicalJsonBytes}.`,
      ),
    );
  }

  if (errors.length > 0) {
    return { document, json, html: null, errors, warnings };
  }

  const renderer = getModeRenderer(document.mode, registries);
  if (!renderer) {
    return { document, json, html: null, errors, warnings };
  }

  const renderDocument =
    options.variablePreviewMode === "sample"
      ? createSamplePreviewDocument(document, registries.variables)
      : document;
  const html = renderer(renderDocument, registries, options);
  const htmlBytes = utf8ByteLength(html);
  if (htmlBytes > VISUAL_DOCUMENT_LIMITS.maxHtmlBytes) {
    return {
      document,
      json,
      html: null,
      errors: [
        ...errors,
        issue(
          "document/html-too-large",
          `Rendered HTML is ${htmlBytes} bytes, exceeding the maximum of ${VISUAL_DOCUMENT_LIMITS.maxHtmlBytes}.`,
        ),
      ],
      warnings,
    };
  }

  return { document, json, html, errors, warnings };
}
