// Explicit mode presets (task 12.2, design.md decision #3): a shared
// provider plus `EmailVisualBuilder` / `LandingPageVisualBuilder`
// compositions instead of mode booleans. Consumers can also rebuild their
// own composition from the exported compound components under a
// `BuilderProvider`.

import type { VariableDefinition, VisualDocumentMode } from "../types/index.js";
import type { ReactNode } from "react";
import type { BuilderController } from "../core/controller/controller.js";
import type { BuilderRegistries } from "../core/registry/types.js";
import type { AssetAdapter } from "./asset-adapter.js";
import { BlockLibrary } from "./block-library.js";
import { Canvas } from "./canvas.js";
import {
  EmailComposerShell,
  type EmailComposerMetadataProps,
} from "./email-composer-shell.js";
import { Inspector } from "./inspector.js";
import type { BuilderLabels } from "./labels.js";
import { Layers } from "./layers.js";
import { Preview } from "./preview.js";
import { BuilderProvider } from "./provider.js";
import { SidebarStatusControls, Toolbar } from "./toolbar.js";
import { ValidationReview } from "./validation-review.js";
import { LibraryRail, Workspace, type WorkspaceLayout } from "./workspace.js";

export interface VisualBuilderPresetProps {
  controller: BuilderController;
  registries?: BuilderRegistries;
  variables?: readonly VariableDefinition[];
  labels?: Partial<BuilderLabels>;
  layout?: WorkspaceLayout;
  /** Upload adapter for the image inspector; omit to allow URL entry only. */
  assetAdapter?: AssetAdapter;
  /** Consumer actions rendered at the toolbar's trailing edge (e.g. a save button using `useBuilderActions().export`). */
  toolbarActions?: ReactNode;
  /** Host-owned notice shown above validation in the desktop sidebar and at the top of narrow layouts. */
  sidebarStatusNotice?: ReactNode;
  /** Host-owned document title (e.g. a template name) shown in the toolbar next to undo/redo. Omit `onTitleChange` to leave it out. */
  toolbarTitle?: string;
  onToolbarTitleChange?: (value: string) => void;
}

export interface EmailVisualBuilderProps
  extends VisualBuilderPresetProps, EmailComposerMetadataProps {
  /** Alias for `toolbarTitle`/`onToolbarTitleChange` — the template name shown in the toolbar. */
  templateName?: string;
  onTemplateNameChange?: (value: string) => void;
}

function VisualBuilderPreset({
  mode,
  controller,
  registries,
  variables,
  labels,
  layout,
  assetAdapter,
  toolbarActions,
  sidebarStatusNotice,
  toolbarTitle,
  onToolbarTitleChange,
  emailComposer,
}: VisualBuilderPresetProps & {
  mode: VisualDocumentMode;
  emailComposer?: EmailComposerMetadataProps;
}): React.JSX.Element {
  return (
    <BuilderProvider
      controller={controller}
      mode={mode}
      registries={registries}
      variables={variables}
      labels={labels}
      assetAdapter={assetAdapter}
    >
      {/* A real `<form>` so the toolbar title/subject `required` attributes get native
          HTML5 constraint validation (browser tooltip + focus) instead of being inert;
          nothing here should ever navigate on submit, so it's always prevented. */}
      <form
        className="donativus-vb-editor"
        onSubmit={(event) => event.preventDefault()}
      >
        <Toolbar titleValue={toolbarTitle} onTitleChange={onToolbarTitleChange}>
          {toolbarActions}
        </Toolbar>
        <Workspace
          layout={layout}
          narrowStatusNotice={sidebarStatusNotice}
          library={
            <div className="donativus-vb-left-column">
              <LibraryRail blocks={<BlockLibrary />} layers={<Layers />} />
              <SidebarStatusControls notice={sidebarStatusNotice} />
            </div>
          }
          inspector={<Inspector />}
        >
          {mode === "email" ? (
            <EmailComposerShell {...emailComposer}>
              <Canvas />
            </EmailComposerShell>
          ) : (
            <Canvas />
          )}
          <ValidationReview />
          <Preview />
        </Workspace>
      </form>
    </BuilderProvider>
  );
}

/** The default email editor composition. Refuses documents whose mode is not `email`. */
export function EmailVisualBuilder(
  props: EmailVisualBuilderProps,
): React.JSX.Element {
  const {
    senderName,
    senderEmail,
    subject,
    isSaved,
    hasUnsavedChanges,
    onSenderNameChange,
    onSubjectChange,
    templateName,
    onTemplateNameChange,
    ...presetProps
  } = props;
  return (
    <VisualBuilderPreset
      {...presetProps}
      mode="email"
      toolbarTitle={templateName}
      onToolbarTitleChange={onTemplateNameChange}
      emailComposer={{
        senderName,
        senderEmail,
        subject,
        templateName,
        isSaved,
        hasUnsavedChanges,
        onSenderNameChange,
        onSubjectChange,
      }}
    />
  );
}

/** The default landing-page editor composition. Refuses documents whose mode is not `landing-page`. */
export function LandingPageVisualBuilder(
  props: VisualBuilderPresetProps,
): React.JSX.Element {
  return <VisualBuilderPreset {...props} mode="landing-page" />;
}
