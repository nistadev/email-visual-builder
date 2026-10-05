// Email-only presentation shell. Sender and subject are host-owned metadata,
// deliberately kept outside the visual-document schema. A callback opts its
// field into editing; otherwise the supplied value (or localized default) is
// rendered as read-only composer chrome.

import { Ellipsis, Eye, EyeOff } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useDocument, usePreviewDevice } from "./node-helpers.js";
import { useBuilderMeta } from "./provider.js";

const EMAIL_COMPOSER_VIEWPORT_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
} as const;

export interface EmailComposerMetadataProps {
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  /** Read-only display of the toolbar's template-name input (edited there, not here); falls back to the localized composer title when empty. */
  templateName?: string;
  /** Consumer-owned persistence state; the builder cannot infer whether an exported document has been stored. */
  isSaved?: boolean;
  /** True when host-owned metadata or the visual document differs from its last saved version. */
  hasUnsavedChanges?: boolean;
  onSenderNameChange?: (senderName: string) => void;
  onSubjectChange?: (subject: string) => void;
}

export interface EmailComposerShellProps extends EmailComposerMetadataProps {
  children: ReactNode;
}

interface ComposerFieldProps {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: ((value: string) => void) | undefined;
  inputMode?: "email" | "text";
  placeholder?: string;
  required?: boolean;
  previewText?: string;
  previewTextLabel?: string;
}

function SenderField({
  label,
  name,
  email,
  fallbackName,
  fallbackEmail,
  onNameChange,
}: {
  label: string;
  name: string | undefined;
  email: string | undefined;
  fallbackName: string;
  fallbackEmail: string;
  onNameChange: ((name: string) => void) | undefined;
}): React.JSX.Element {
  const [localName, setLocalName] = useState(fallbackName);
  const resolvedName = name ?? localName;
  const resolvedEmail = email ?? fallbackEmail;
  return (
    <div className="donativus-vb-email-composer-field">
      <span className="donativus-vb-email-composer-field-label">{label}</span>
      <span className="donativus-vb-email-composer-sender">
        {onNameChange ? (
          <input
            type="text"
            className="donativus-vb-email-composer-input"
            aria-label="Sender name"
            value={resolvedName}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (name === undefined) setLocalName(nextValue);
              onNameChange(nextValue);
            }}
          />
        ) : (
          <span className="donativus-vb-email-composer-value">
            {resolvedName}
          </span>
        )}
        <span
          className="donativus-vb-email-composer-email"
          title={resolvedEmail}
        >
          &lt;{resolvedEmail}&gt;
        </span>
      </span>
    </div>
  );
}

function ComposerField({
  label,
  value,
  fallback,
  onChange,
  inputMode = "text",
  placeholder,
  required = false,
  previewText,
  previewTextLabel,
}: ComposerFieldProps): React.JSX.Element {
  const [localValue, setLocalValue] = useState(fallback);
  const resolvedValue = value ?? localValue;

  return (
    <div className="donativus-vb-email-composer-field">
      <span className="donativus-vb-email-composer-field-label">{label}</span>
      <span className="donativus-vb-email-composer-subject-line">
        {onChange ? (
          <input
            type="text"
            className="donativus-vb-email-composer-input"
            aria-label={label}
            inputMode={inputMode}
            spellCheck={inputMode !== "email"}
            placeholder={placeholder}
            required={required}
            value={resolvedValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (value === undefined) setLocalValue(nextValue);
              onChange(nextValue);
            }}
          />
        ) : (
          <span
            className="donativus-vb-email-composer-value"
            title={resolvedValue}
          >
            {resolvedValue}
          </span>
        )}
        {previewText ? (
          <span
            className="donativus-vb-email-composer-preview-text"
            aria-label={previewTextLabel}
            title={previewText}
          >
            — {previewText}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** A compact, iOS Mail-inspired composer around the email canvas. */
export function EmailComposerShell({
  senderName,
  senderEmail,
  subject,
  templateName,
  isSaved = false,
  hasUnsavedChanges = false,
  onSenderNameChange,
  onSubjectChange,
  children,
}: EmailComposerShellProps): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const [detailsHidden, setDetailsHidden] = useState(false);
  const document = useDocument();
  const previewDevice = usePreviewDevice();
  const previewText =
    document.mode === "email" ? document.settings.previewText.trim() : "";
  const viewportStyle = {
    "--donativus-vb-email-composer-viewport-width":
      EMAIL_COMPOSER_VIEWPORT_WIDTHS[previewDevice],
  } as CSSProperties;

  return (
    <section
      className="donativus-vb-email-composer bg-base-100 border-base-300"
      aria-label={labels.emailComposerLabel}
      data-vb-email-composer
      data-vb-preview-device={previewDevice}
      style={viewportStyle}
    >
      <header className="donativus-vb-email-composer-header border-base-300">
        <span className="donativus-vb-email-window-controls" aria-hidden="true">
          <span data-vb-window-control="close" />
          <span data-vb-window-control="minimize" />
          <span data-vb-window-control="zoom" />
        </span>
        <strong>{templateName?.trim() || labels.emailComposerTitle}</strong>
        <span className="donativus-vb-email-composer-header-actions">
          <span
            className="badge badge-ghost badge-sm"
            data-vb-email-save-state={
              hasUnsavedChanges ? "unsaved" : isSaved ? "saved" : "draft"
            }
          >
            {hasUnsavedChanges
              ? labels.emailComposerUnsavedChanges
              : isSaved
                ? labels.emailComposerSaved
                : labels.emailComposerDraft}
          </span>
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-ghost btn-xs btn-square"
              aria-label={labels.emailComposerOptions}
              title={labels.emailComposerOptions}
            >
              <Ellipsis size={16} aria-hidden="true" />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-box z-20 mt-2 w-56 border border-base-300 p-1 shadow"
            >
              <li>
                <button
                  type="button"
                  onClick={() => setDetailsHidden((hidden) => !hidden)}
                >
                  {detailsHidden ? (
                    <Eye size={15} aria-hidden="true" />
                  ) : (
                    <EyeOff size={15} aria-hidden="true" />
                  )}
                  {detailsHidden
                    ? labels.emailComposerShowDetails
                    : labels.emailComposerHideDetails}
                </button>
              </li>
            </ul>
          </div>
        </span>
      </header>

      {!detailsHidden ? (
        <div className="donativus-vb-email-composer-fields border-base-300">
          <SenderField
            label={labels.emailSenderLabel}
            name={senderName}
            email={senderEmail}
            fallbackName={labels.emailDefaultSenderName}
            fallbackEmail={labels.emailDefaultSenderEmail}
            onNameChange={onSenderNameChange}
          />
          <ComposerField
            label={labels.emailSubjectLabel}
            value={subject}
            fallback={labels.emailDefaultSubject}
            onChange={onSubjectChange}
            placeholder={labels.emailSubjectPlaceholder}
            required={Boolean(onSubjectChange)}
            previewText={previewText}
            previewTextLabel={labels.emailPreviewTextSeparator}
          />
        </div>
      ) : null}

      <div className="donativus-vb-email-composer-body">{children}</div>
    </section>
  );
}
