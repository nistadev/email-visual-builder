// Fullscreen rendered-HTML preview. The pure renderer output — never the
// canvas DOM — is shown in a sandboxed iframe at exact desktop, tablet, and
// mobile viewport sizes. The modal traps focus, closes with Escape, restores
// focus to its opener, and locks background scrolling while open.

import {
  Braces,
  Code2,
  Copy,
  FileJson2,
  Monitor,
  Smartphone,
  TabletSmartphone,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { exportVisualDocument } from "../renderers/pipeline.js";
import { useDocument, usePreviewDevice } from "./node-helpers.js";
import { useBuilderMeta, useEditorChrome } from "./provider.js";

type PreviewViewport = "desktop" | "tablet" | "mobile";
type PreviewDebugView = "html" | "json";

interface PreviewViewportDefinition {
  id: PreviewViewport;
  width: number;
  height: number;
}

const PREVIEW_VIEWPORTS: readonly PreviewViewportDefinition[] = [
  { id: "desktop", width: 1280, height: 800 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 375, height: 812 },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const VOID_HTML_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function PreviewDeviceIcon({
  device,
}: {
  device: PreviewViewport;
}): React.JSX.Element {
  if (device === "mobile") {
    return <Smartphone size={16} aria-hidden="true" />;
  }
  if (device === "tablet") {
    return <TabletSmartphone size={16} aria-hidden="true" />;
  }
  return <Monitor size={16} aria-hidden="true" />;
}

function fallbackCopyToClipboard(value: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.("copy") ?? false;
  textarea.remove();
  return copied;
}

/** Makes renderer output readable for inspection without changing its content. */
function formatHtmlSource(html: string): string {
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? [html];
  const lines: string[] = [];
  let depth = 0;

  for (const token of tokens) {
    const value = token.trim();
    if (!value) continue;
    if (!value.startsWith("<")) {
      lines.push(`${"  ".repeat(depth)}${value}`);
      continue;
    }

    const closingTag = /^<\s*\//.test(value);
    const tag = /^<\s*\/?\s*([a-z0-9-]+)/i.exec(value)?.[1]?.toLowerCase();
    const standalone =
      /^<!/.test(value) ||
      /^<!--/.test(value) ||
      /\/\s*>$/.test(value) ||
      (tag !== undefined && VOID_HTML_ELEMENTS.has(tag));

    if (closingTag) depth = Math.max(0, depth - 1);
    lines.push(`${"  ".repeat(depth)}${value}`);
    if (!closingTag && !standalone) depth += 1;
  }

  return lines.join("\n");
}

export function Preview(): React.JSX.Element | null {
  const { labels, registries } = useBuilderMeta();
  const {
    openPanel,
    setOpenPanel,
    variablePreviewMode,
    setVariablePreviewMode,
  } = useEditorChrome();
  const visualDocument = useDocument();
  const canvasPreviewDevice = usePreviewDevice();
  const [selectedViewport, setSelectedViewport] =
    useState<PreviewViewport | null>(null);
  const [debugView, setDebugView] = useState<PreviewDebugView | null>(null);
  const [copiedView, setCopiedView] = useState<PreviewDebugView | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const titleId = useId();
  const isOpen = openPanel === "preview";

  const result = useMemo(
    () =>
      isOpen
        ? exportVisualDocument(visualDocument, registries, {
            variablePreviewMode,
          })
        : null,
    [isOpen, visualDocument, registries, variablePreviewMode],
  );

  const closePreview = useCallback(() => {
    setSelectedViewport(null);
    setDebugView(null);
    setCopiedView(null);
    setOpenPanel(null);
  }, [setOpenPanel]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || typeof globalThis.document === "undefined") return;

    const previouslyFocused = globalThis.document
      .activeElement as HTMLElement | null;
    const body = globalThis.document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const focusFrame = globalThis.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      globalThis.cancelAnimationFrame(focusFrame);
      body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen || !result) return null;

  const activeViewportId = selectedViewport ?? canvasPreviewDevice;
  const activeViewport =
    PREVIEW_VIEWPORTS.find(({ id }) => id === activeViewportId) ??
    PREVIEW_VIEWPORTS[0]!;
  const activeViewportLabel = labels.previewDeviceNames[activeViewport.id];
  const sourceTitle =
    debugView === "html" ? labels.previewHtmlSource : labels.previewJsonLayout;
  const source =
    debugView === "html"
      ? result.html === null
        ? null
        : formatHtmlSource(result.html)
      : JSON.stringify(visualDocument, null, 2);

  const copySource = async (): Promise<void> => {
    if (!debugView || source === null) return;
    let copied = false;
    try {
      if (globalThis.navigator.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(source);
        copied = true;
      } else {
        copied = fallbackCopyToClipboard(source);
      }
    } catch {
      copied = fallbackCopyToClipboard(source);
    }
    if (!copied) return;
    setCopiedView(debugView);
    if (copyFeedbackTimeoutRef.current !== null) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }
    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopiedView(null);
      copyFeedbackTimeoutRef.current = null;
    }, 1600);
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePreview();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && globalThis.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="donativus-vb-preview-overlay"
      onClick={closePreview}
      data-vb-preview-overlay
    >
      <div
        ref={dialogRef}
        className="donativus-vb-preview-modal bg-base-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="donativus-vb-preview-header bg-base-100 border-base-300">
          <div className="donativus-vb-preview-heading">
            <h2 id={titleId}>{labels.previewTitle}</h2>
            <span className="badge badge-ghost badge-sm" aria-live="polite">
              {labels.previewViewportDimensions(
                activeViewport.width,
                activeViewport.height,
              )}
            </span>
          </div>

          <div
            className="donativus-vb-preview-device-picker join"
            role="group"
            aria-label={labels.previewDeviceSelector}
          >
            {PREVIEW_VIEWPORTS.map((viewport) => {
              const isActive = viewport.id === activeViewport.id;
              return (
                <button
                  key={viewport.id}
                  type="button"
                  className={`btn btn-sm join-item${isActive ? " btn-active" : ""}`}
                  aria-label={labels.previewDeviceNames[viewport.id]}
                  aria-pressed={isActive}
                  onClick={() => setSelectedViewport(viewport.id)}
                >
                  <PreviewDeviceIcon device={viewport.id} />
                  <span>{labels.previewDeviceNames[viewport.id]}</span>
                </button>
              );
            })}
          </div>

          <div className="donativus-vb-preview-actions">
            <div className="donativus-vb-preview-debug-actions join">
              <button
                type="button"
                className={`btn btn-sm btn-square join-item tooltip tooltip-left${variablePreviewMode === "sample" ? " btn-active" : " btn-ghost"}`}
                aria-pressed={variablePreviewMode === "sample"}
                aria-label={
                  variablePreviewMode === "sample"
                    ? labels.variablePreviewTokens
                    : labels.variablePreviewSamples
                }
                data-tip={
                  variablePreviewMode === "sample"
                    ? labels.variablePreviewTokens
                    : labels.variablePreviewSamples
                }
                onClick={() =>
                  setVariablePreviewMode(
                    variablePreviewMode === "sample" ? "token" : "sample",
                  )
                }
              >
                <Braces size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn btn-sm btn-square join-item tooltip tooltip-left${debugView === "html" ? " btn-active" : " btn-ghost"}`}
                aria-pressed={debugView === "html"}
                aria-label={labels.previewHtmlSource}
                data-tip={labels.previewHtmlSource}
                onClick={() =>
                  setDebugView((current) =>
                    current === "html" ? null : "html",
                  )
                }
              >
                <Code2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn btn-sm btn-square join-item tooltip tooltip-left${debugView === "json" ? " btn-active" : " btn-ghost"}`}
                aria-pressed={debugView === "json"}
                aria-label={labels.previewJsonLayout}
                data-tip={labels.previewJsonLayout}
                onClick={() =>
                  setDebugView((current) =>
                    current === "json" ? null : "json",
                  )
                }
              >
                <FileJson2 size={15} aria-hidden="true" />
              </button>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label={labels.close}
              onClick={closePreview}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          className="donativus-vb-preview-stage"
          data-vb-preview-device={activeViewport.id}
        >
          {debugView ? (
            <section
              className="donativus-vb-preview-source bg-base-100 border-base-300"
              aria-label={sourceTitle}
              data-vb-preview-source={debugView}
            >
              <header className="donativus-vb-preview-source-header border-base-300">
                <strong>{sourceTitle}</strong>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label={labels.previewCopySource}
                  disabled={source === null}
                  onClick={() => void copySource()}
                >
                  <Copy size={15} aria-hidden="true" />
                  {copiedView === debugView
                    ? labels.previewCopied
                    : labels.previewCopySource}
                </button>
              </header>
              <pre>
                <code>{source ?? labels.previewUnavailable}</code>
              </pre>
            </section>
          ) : result.html === null ? (
            <div
              className="donativus-vb-preview-empty bg-base-100 border-base-300"
              role="note"
            >
              <p>{labels.previewUnavailable}</p>
            </div>
          ) : (
            <div
              className="donativus-vb-preview-device bg-base-100 border-base-300"
              style={
                {
                  width: `${activeViewport.width}px`,
                  "--donativus-vb-preview-device-height": `${activeViewport.height}px`,
                } as CSSProperties
              }
            >
              <div className="donativus-vb-preview-device-bar border-base-300">
                <span aria-hidden="true" />
                <strong>{activeViewportLabel}</strong>
                <span>
                  {activeViewport.width} × {activeViewport.height}
                </span>
              </div>
              <iframe
                className="donativus-vb-preview-frame"
                title={`${labels.previewTitle} — ${activeViewportLabel}`}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={result.html}
                style={{ height: "100%" }}
                data-vb-preview-scroll-viewport
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
