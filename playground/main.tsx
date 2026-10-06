// The public playground, deployed to GitHub Pages: the editor in a page with
// no Tailwind and no daisyUI, styled only by the standalone stylesheet. The
// document is kept in this browser's localStorage; nothing is uploaded.
// Run locally with `pnpm build && pnpm playground`.
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../dist/react/standalone.css";
import {
  BuilderController,
  createBuilderRegistries,
  createStarterDocument,
  createVariableRegistry,
  parseVisualDocument,
  serializeVisualDocument,
  type BuilderRegistries,
  type VariableDefinition,
} from "../src/core/index.js";
import { EmailVisualBuilder } from "../src/react/index.js";
import {
  DEFAULT_RENDERER_REGISTRIES,
  exportVisualDocument,
} from "../src/renderers/index.js";

const DOCUMENT_KEY = "email-visual-builder:playground:document";
const SUBJECT_KEY = "email-visual-builder:playground:subject";
const THEME_KEY = "email-visual-builder:playground:theme";
const REPOSITORY_URL = "https://github.com/nistadev/email-visual-builder";

const VARIABLES: readonly VariableDefinition[] = [
  {
    key: "recipient.firstName",
    token: "%recipient.firstName%",
    label: "Recipient first name",
    sampleValue: "Alex",
    allowedContexts: ["text"],
  },
  {
    key: "recipient.email",
    token: "%recipient.email%",
    label: "Recipient email",
    sampleValue: "alex@example.com",
    allowedContexts: ["text"],
  },
  {
    key: "unsubscribe_url",
    token: "%unsubscribe_url%",
    label: "Unsubscribe link",
    sampleValue: "https://example.com/unsubscribe",
    allowedContexts: ["url", "email-system-link"],
  },
];

function buildRegistries(): BuilderRegistries {
  const variables = createVariableRegistry(VARIABLES);
  if (!variables.ok) throw new Error("Invalid playground variables");
  const registries = createBuilderRegistries({
    blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
    modes: DEFAULT_RENDERER_REGISTRIES.modes,
    inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
    variables: variables.value,
  });
  if (!registries.ok) throw new Error("Invalid playground registries");
  return registries.value;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota: the editor still works, it just forgets.
  }
}

function createController(registries: BuilderRegistries): BuilderController {
  const stored = readStored(DOCUMENT_KEY);
  if (stored) {
    try {
      const parsed = parseVisualDocument(JSON.parse(stored), registries);
      if (parsed.ok && parsed.value.mode === "email")
        return new BuilderController(parsed.value, { registries });
    } catch {
      // A document this version cannot read falls through to a fresh one.
    }
  }
  return new BuilderController(createStarterDocument("email", registries), {
    registries,
  });
}

interface Status {
  message: string;
  error: boolean;
}

function Playground(): React.JSX.Element {
  const registries = useMemo(buildRegistries, []);
  const controller = useMemo(() => createController(registries), [registries]);
  const [subject, setSubject] = useState(
    () => readStored(SUBJECT_KEY) ?? "A little goes a long way",
  );
  const [theme, setTheme] = useState(() => readStored(THEME_KEY) ?? "light");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(
    () =>
      controller.subscribe(() => {
        writeStored(
          DOCUMENT_KEY,
          serializeVisualDocument(controller.getState().document),
        );
      }),
    [controller],
  );

  useEffect(() => writeStored(SUBJECT_KEY, subject), [subject]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStored(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async (kind: "html" | "json"): Promise<void> => {
    const result = exportVisualDocument(
      controller.getState().document,
      registries,
    );
    const text = kind === "html" ? result.html : result.json;
    if (text === null) {
      setStatus({
        message: `Fix ${result.errors.length} issue(s) before copying: ${result.errors[0]?.message ?? "the document is invalid"}`,
        error: true,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus({
        message: `${kind === "html" ? "HTML" : "JSON"} copied to the clipboard`,
        error: false,
      });
    } catch {
      setStatus({
        message: "The browser blocked clipboard access",
        error: true,
      });
    }
  };

  const reset = (): void => {
    if (!confirm("Start over with an empty email? This cannot be undone."))
      return;
    controller.loadDocument(createStarterDocument("email", registries));
  };

  return (
    <div className="pg-shell">
      <header className="pg-header">
        <h1 className="pg-title">email-visual-builder</h1>
        <p className="pg-note">
          Build an email, then copy the HTML. Your work stays in this browser.
        </p>
        <button type="button" className="pg-button" onClick={reset}>
          Start over
        </button>
        <button
          type="button"
          className="pg-button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <a className="pg-link" href={REPOSITORY_URL}>
          GitHub
        </a>
      </header>
      <main className="pg-editor">
        <EmailVisualBuilder
          controller={controller}
          registries={registries}
          variables={VARIABLES}
          senderName="Your name"
          senderEmail="you@example.com"
          subject={subject}
          onSubjectChange={setSubject}
          toolbarActions={
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void copy("json")}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void copy("html")}
              >
                Copy HTML
              </button>
            </>
          }
        />
      </main>
      {status ? (
        <div
          className={`pg-status${status.error ? " is-error" : ""}`}
          role="status"
        >
          {status.message}
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Playground />);
