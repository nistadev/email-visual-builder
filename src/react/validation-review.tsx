// The validation review panel (tasks 12.2/12.6): runs the full export
// pipeline on open and lists blocking errors and quality warnings with their
// node/path locations. Selecting an issue selects and reveals its node.

import type {
  VisualDocumentQualityWarning,
  VisualDocumentValidationIssue,
} from "../types/index.js";
import { X } from "lucide-react";
import { useMemo } from "react";
import { blockDisplayName } from "./labels.js";
import { formatIssueMessage } from "./issue-messages.js";
import { focusNodeElement, useDocument } from "./node-helpers.js";
import { exportVisualDocument } from "../renderers/pipeline.js";
import {
  useBuilderActions,
  useBuilderMeta,
  useEditorChrome,
} from "./provider.js";

function IssueList({
  items,
  heading,
  tone,
}: {
  items: readonly (
    VisualDocumentValidationIssue | VisualDocumentQualityWarning
  )[];
  heading: string;
  tone: "error" | "warning";
}): React.JSX.Element | null {
  const actions = useBuilderActions();
  const { controller, labels } = useBuilderMeta();
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className={`donativus-vb-issue-heading text-${tone}`}>{heading}</h3>
      <ul className="donativus-vb-issue-list">
        {items.map((item, index) => {
          const node = item.nodeId
            ? controller.getState().document.nodes[item.nodeId]
            : undefined;
          return (
            <li key={`${item.code}-${item.nodeId ?? ""}-${index}`}>
              <button
                type="button"
                className="donativus-vb-issue btn btn-ghost btn-sm btn-block justify-start"
                onClick={() => {
                  if (item.nodeId) {
                    actions.select(item.nodeId);
                    focusNodeElement(item.nodeId);
                  }
                }}
              >
                <span
                  className={`badge badge-${tone} badge-xs`}
                  aria-hidden="true"
                />
                <span className="donativus-vb-issue-message">
                  {formatIssueMessage(item)}
                </span>
                {node && (
                  <span className="badge badge-ghost badge-sm">
                    {blockDisplayName(labels, node.type)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ValidationReview(): React.JSX.Element | null {
  const { labels, registries } = useBuilderMeta();
  const { openPanel, setOpenPanel } = useEditorChrome();
  const document = useDocument();

  // Full pipeline result, recomputed per document identity while the panel is open.
  const result = useMemo(
    () =>
      openPanel === "validation"
        ? exportVisualDocument(document, registries)
        : null,
    [openPanel, document, registries],
  );

  if (openPanel !== "validation" || !result) return null;

  return (
    <div
      className="donativus-vb-panel bg-base-100 border-base-300"
      role="dialog"
      aria-label={labels.validationReviewTitle}
    >
      <div className="donativus-vb-panel-header">
        <h2>{labels.validationReviewTitle}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label={labels.close}
          onClick={() => setOpenPanel(null)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {result.errors.length === 0 && result.warnings.length === 0 ? (
        <p className="donativus-vb-empty-hint">{labels.validationNoIssues}</p>
      ) : (
        <>
          <IssueList
            items={result.errors}
            heading={labels.validationErrorsHeading}
            tone="error"
          />
          <IssueList
            items={result.warnings}
            heading={labels.validationWarningsHeading}
            tone="warning"
          />
        </>
      )}
    </div>
  );
}
