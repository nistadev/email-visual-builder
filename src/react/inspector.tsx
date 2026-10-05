// The contextual inspector (task 12.8): grouped Content, Style, Spacing,
// Link, and Accessibility panels for the selected block, all committing
// through typed `update-node-props` / `update-rich-text` commands. The
// rich-text block's Content group hosts the section-11 Lexical adapter with
// coalesced controller commits and undo/redo resync.

import type {
  CtaProps,
  DividerProps,
  HeadingProps,
  ImageProps,
  RichTextProps,
  RichTextValue,
  SectionProps,
  SocialProps,
  SpacingValue,
  SpacerProps,
  VisualDocumentEmailSettings,
  VisualDocumentLandingPageSettings,
  VisualBuilderNode,
} from "../types/index.js";
import { useRef, type ReactNode } from "react";
import { ImageSourceControls } from "./image-source-controls.js";
import { blockDisplayName } from "./labels.js";
import { useDocument, useNode, useSelectedNodeId } from "./node-helpers.js";
import {
  useBuilderActions,
  useBuilderMeta,
  useBuilderSelector,
  useEditorChrome,
} from "./provider.js";
import { createRichTextCommitHandler } from "./rich-text/controller-commit.js";
import { RichTextEditor } from "./rich-text/RichTextEditor.js";
import {
  AlignField,
  ColorField,
  MarginFields,
  NumberField,
  SelectField,
  ShadowFields,
  SocialItemsField,
  SpacingFields,
  TemplatedTextField,
  TextField,
  ToggleField,
  TypographyFields,
  WidthField,
  type FieldCommit,
  usePropsCommit,
} from "./inspector-fields.js";

function equalColumnWidths(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function rebalanceColumnWidths(
  current: readonly number[],
  changedIndex: number,
  requestedValue: number,
): number[] {
  if (current.length <= 1) return [100];

  const nextValue = Math.min(
    100 - (current.length - 1),
    Math.max(1, requestedValue),
  );
  const remaining = 100 - nextValue;
  const otherIndexes = current
    .map((_, index) => index)
    .filter((index) => index !== changedIndex);
  const otherTotal = otherIndexes.reduce(
    (total, index) => total + (current[index] ?? 0),
    0,
  );
  let allocated = 0;

  return current.map((_, index) => {
    if (index === changedIndex) return nextValue;
    const isLast = index === otherIndexes[otherIndexes.length - 1];
    if (isLast) return Math.round((remaining - allocated) * 100) / 100;
    const share =
      otherTotal > 0
        ? ((current[index] ?? 0) / otherTotal) * remaining
        : remaining / otherIndexes.length;
    const rounded = Math.round(share * 100) / 100;
    allocated += rounded;
    return rounded;
  });
}

function InspectorGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <details className="donativus-vb-inspector-group" open>
      <summary className="donativus-vb-inspector-group-title">{title}</summary>
      <div className="donativus-vb-inspector-group-body">{children}</div>
    </details>
  );
}

/** Rich-text editing surface with external-change resync: undo/redo (or any non-editor change) bumps the token so Lexical reloads the document value. */
function RichTextContentField({
  nodeId,
  value,
  propKey = "value",
  ariaLabel,
}: {
  nodeId: string;
  value: RichTextValue;
  propKey?: "value" | "text" | "label";
  ariaLabel?: string;
}): React.JSX.Element {
  const { controller, registries, variables, labels } = useBuilderMeta();
  const { variablePreviewMode } = useEditorChrome();
  const linkStyle = useBuilderSelector(
    (state) => state.document.settings.linkStyle,
  );
  const lastCommittedRef = useRef<RichTextValue>(value);
  const resyncTokenRef = useRef(0);

  const documentValue = useBuilderSelector((state) => {
    const props = state.document.nodes[nodeId]?.props as
      Record<string, unknown> | undefined;
    return props?.[propKey] as RichTextValue | undefined;
  });
  if (
    documentValue !== undefined &&
    documentValue !== lastCommittedRef.current
  ) {
    // The document changed under the editor (undo/redo/document replacement) — force a reload.
    lastCommittedRef.current = documentValue;
    resyncTokenRef.current += 1;
  }

  const commitHandler = (nextValue: RichTextValue): void => {
    if (propKey === "value") {
      createRichTextCommitHandler(controller, nodeId)(nextValue);
      return;
    }
    const currentNode = controller.getState().document.nodes[nodeId];
    if (!currentNode) return;
    controller.dispatch({
      type: "update-node-props",
      nodeId,
      props: {
        ...(currentNode.props as Record<string, unknown>),
        [propKey]: nextValue,
      },
    });
  };
  return (
    <RichTextEditor
      key={nodeId}
      initialValue={documentValue ?? value}
      registry={registries.variables}
      variables={variables}
      previewMode={variablePreviewMode}
      ariaLabel={ariaLabel ?? labels.fieldText}
      linkStyle={linkStyle}
      resyncToken={resyncTokenRef.current}
      onCommit={(nextValue) => {
        commitHandler(nextValue);
        // `dispatch` is synchronous and the handler stores a *parsed copy* —
        // capture that stored object so the render-time identity comparison
        // above only fires for external changes (undo/redo), never for the
        // editor's own commits.
        const stored = (
          controller.getState().document.nodes[nodeId]?.props as
            Record<string, unknown> | undefined
        )?.[propKey] as RichTextValue | undefined;
        lastCommittedRef.current = stored ?? nextValue;
      }}
    />
  );
}

function NodeInspector({
  node,
}: {
  node: VisualBuilderNode;
}): React.JSX.Element | null {
  const { labels } = useBuilderMeta();
  const actions = useBuilderActions();
  const commit = usePropsCommit(node.id);

  switch (node.type) {
    case "section": {
      const blockProps = node.props as SectionProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <WidthField
              label={labels.fieldContentWidth}
              commit={commit}
              value={
                blockProps.contentWidth as {
                  unit: "px" | "percent";
                  value: number;
                }
              }
              propKey="contentWidth"
            />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <ColorField
              label={labels.fieldBackgroundColor}
              commit={commit}
              value={blockProps.background.color}
              propKey="background"
              transform={(color) => ({ color })}
            />
            <ShadowFields commit={commit} value={blockProps.shadow} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "columns": {
      const blockProps = node.props as {
        columnWidthRatios: number[];
        responsiveStack: string;
        spacing: SpacingValue;
        margin: SpacingValue;
      };
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <SelectField
              label={labels.fieldColumnCount}
              commit={(patch) => {
                const result = actions.dispatch({
                  type: "update-columns",
                  nodeId: node.id,
                  columnWidthRatios: equalColumnWidths(
                    Number(patch.columnCount),
                  ),
                });
                return result.ok ? [] : result.issues;
              }}
              value={String(blockProps.columnWidthRatios.length)}
              propKey="columnCount"
              options={[1, 2, 3, 4].map((count) => ({
                value: String(count),
                label: String(count),
              }))}
              transform={(value) => Number(value)}
            />
            <div className="donativus-vb-column-widths">
              {blockProps.columnWidthRatios.map((ratio, index) => (
                <NumberField
                  key={index}
                  label={labels.fieldColumnWidth(index + 1)}
                  commit={(patch) =>
                    commit({
                      columnWidthRatios: rebalanceColumnWidths(
                        blockProps.columnWidthRatios,
                        index,
                        Number(patch.columnWidthRatios),
                      ),
                    })
                  }
                  value={ratio}
                  propKey="columnWidthRatios"
                  min={1}
                  max={100 - (blockProps.columnWidthRatios.length - 1)}
                />
              ))}
            </div>
            <SelectField
              label={labels.fieldResponsiveStack}
              commit={commit}
              value={blockProps.responsiveStack}
              propKey="responsiveStack"
              options={[
                { value: "stack", label: labels.responsiveStackOn },
                { value: "no-stack", label: labels.responsiveStackOff },
              ]}
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "column": {
      const blockProps = node.props as {
        background: { color: string | null };
        spacing: SpacingValue;
        margin: SpacingValue;
      };
      return (
        <>
          <InspectorGroup title={labels.groupStyle}>
            <ColorField
              label={labels.fieldBackgroundColor}
              commit={commit}
              value={blockProps.background.color}
              propKey="background"
              transform={(color) => ({ color })}
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "heading": {
      const blockProps = node.props as HeadingProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <SelectField
              label={labels.fieldLevel}
              commit={commit}
              value={String(blockProps.level)}
              propKey="level"
              options={[1, 2, 3, 4, 5, 6].map((level) => ({
                value: String(level),
                label: `H${level}`,
              }))}
              transform={(option) => Number(option)}
            />
            <RichTextContentField
              nodeId={node.id}
              value={blockProps.text}
              propKey="text"
              ariaLabel={labels.fieldText}
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <TypographyFields commit={commit} value={blockProps.typography} />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "rich-text": {
      const blockProps = node.props as RichTextProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <RichTextContentField nodeId={node.id} value={blockProps.value} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <TypographyFields commit={commit} value={blockProps.typography} />
            <ToggleField
              label={labels.fieldBorder}
              commit={commit}
              value={blockProps.border}
              propKey="border"
            />
            {blockProps.border ? (
              <>
                <NumberField
                  label={labels.fieldBorderWidth}
                  commit={commit}
                  value={blockProps.borderWidth}
                  propKey="borderWidth"
                  min={0}
                  max={40}
                />
                <ColorField
                  label={labels.fieldBorderColor}
                  commit={commit}
                  value={blockProps.borderColor}
                  propKey="borderColor"
                />
                <NumberField
                  label={labels.fieldBorderRadius}
                  commit={commit}
                  value={blockProps.borderRadiusPx}
                  propKey="borderRadiusPx"
                  min={0}
                  max={100}
                />
                <ToggleField
                  label={labels.fieldBorderRadiusByCorner}
                  commit={commit}
                  value={blockProps.borderRadiusByCorner}
                  propKey="borderRadiusByCorner"
                />
                {blockProps.borderRadiusByCorner ? (
                  <>
                    <NumberField
                      label={labels.fieldBorderTopLeftRadius}
                      commit={commit}
                      value={blockProps.borderTopLeftRadiusPx}
                      propKey="borderTopLeftRadiusPx"
                      min={0}
                      max={100}
                    />
                    <NumberField
                      label={labels.fieldBorderTopRightRadius}
                      commit={commit}
                      value={blockProps.borderTopRightRadiusPx}
                      propKey="borderTopRightRadiusPx"
                      min={0}
                      max={100}
                    />
                    <NumberField
                      label={labels.fieldBorderBottomRightRadius}
                      commit={commit}
                      value={blockProps.borderBottomRightRadiusPx}
                      propKey="borderBottomRightRadiusPx"
                      min={0}
                      max={100}
                    />
                    <NumberField
                      label={labels.fieldBorderBottomLeftRadius}
                      commit={commit}
                      value={blockProps.borderBottomLeftRadiusPx}
                      propKey="borderBottomLeftRadiusPx"
                      min={0}
                      max={100}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            <AlignField
              commit={(patch) => {
                const align = String(patch.align) as
                  "left" | "center" | "right";
                const result = actions.dispatch({
                  type: "update-rich-text",
                  nodeId: node.id,
                  value: {
                    ...blockProps.value,
                    children: blockProps.value.children.map((child) =>
                      child.type === "paragraph" ? { ...child, align } : child,
                    ),
                  },
                });
                return result.ok ? [] : result.issues;
              }}
              value={
                blockProps.value.children.find(
                  (child) => child.type === "paragraph",
                )?.align ?? "left"
              }
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "image": {
      const blockProps = node.props as ImageProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <ImageSourceControls
              nodeId={node.id}
              asset={blockProps.asset}
              commit={commit}
            />
            <WidthField
              label={labels.fieldWidth}
              commit={commit}
              value={blockProps.displayWidth}
              propKey="displayWidth"
            />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <NumberField
              label={labels.fieldBorderRadius}
              commit={commit}
              value={blockProps.borderRadiusPx}
              propKey="borderRadiusPx"
              min={0}
              max={100}
            />
            <ToggleField
              label={labels.fieldBorderRadiusByCorner}
              commit={commit}
              value={blockProps.borderRadiusByCorner}
              propKey="borderRadiusByCorner"
            />
            {blockProps.borderRadiusByCorner ? (
              <>
                <NumberField
                  label={labels.fieldBorderTopLeftRadius}
                  commit={commit}
                  value={blockProps.borderTopLeftRadiusPx}
                  propKey="borderTopLeftRadiusPx"
                  min={0}
                  max={100}
                />
                <NumberField
                  label={labels.fieldBorderTopRightRadius}
                  commit={commit}
                  value={blockProps.borderTopRightRadiusPx}
                  propKey="borderTopRightRadiusPx"
                  min={0}
                  max={100}
                />
                <NumberField
                  label={labels.fieldBorderBottomRightRadius}
                  commit={commit}
                  value={blockProps.borderBottomRightRadiusPx}
                  propKey="borderBottomRightRadiusPx"
                  min={0}
                  max={100}
                />
                <NumberField
                  label={labels.fieldBorderBottomLeftRadius}
                  commit={commit}
                  value={blockProps.borderBottomLeftRadiusPx}
                  propKey="borderBottomLeftRadiusPx"
                  min={0}
                  max={100}
                />
              </>
            ) : null}
          </InspectorGroup>
          <InspectorGroup title={labels.groupLink}>
            <TemplatedTextField
              label={labels.fieldDestination}
              commit={commit}
              value={blockProps.link}
              propKey="link"
              nullable
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupAccessibility}>
            <TextField
              label={labels.fieldAltText}
              commit={commit}
              value={blockProps.altText}
              propKey="altText"
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "cta": {
      const blockProps = node.props as CtaProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <RichTextContentField
              nodeId={node.id}
              value={blockProps.label}
              propKey="label"
              ariaLabel={labels.fieldLabel}
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupLink}>
            <TemplatedTextField
              label={labels.fieldDestination}
              commit={commit}
              value={blockProps.destination}
              propKey="destination"
            />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <TypographyFields commit={commit} value={blockProps.typography} />
            <ColorField
              label={labels.fieldBackgroundColor}
              commit={commit}
              value={blockProps.backgroundColor}
              propKey="backgroundColor"
            />
            <NumberField
              label={labels.fieldBorderRadius}
              commit={commit}
              value={blockProps.borderRadiusPx}
              propKey="borderRadiusPx"
            />
            <WidthField
              label={labels.fieldWidth}
              commit={commit}
              value={blockProps.width}
              propKey="width"
              allowAuto
            />
            <AlignField commit={commit} value={blockProps.align} />
            <ShadowFields commit={commit} value={blockProps.shadow} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "divider": {
      const blockProps = node.props as DividerProps;
      return (
        <>
          <InspectorGroup title={labels.groupStyle}>
            <ColorField
              label={labels.fieldColor}
              commit={commit}
              value={blockProps.color}
              propKey="color"
            />
            <NumberField
              label={labels.fieldThickness}
              commit={commit}
              value={blockProps.thicknessPx}
              propKey="thicknessPx"
            />
            <SelectField
              label={labels.fieldDividerStyle}
              commit={commit}
              value={blockProps.style}
              propKey="style"
              options={[
                { value: "solid", label: "solid" },
                { value: "dashed", label: "dashed" },
                { value: "dotted", label: "dotted" },
              ]}
            />
            <WidthField
              label={labels.fieldWidth}
              commit={commit}
              value={blockProps.width}
              propKey="width"
            />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "social": {
      const blockProps = node.props as SocialProps;
      return (
        <>
          <InspectorGroup title={labels.groupContent}>
            <SocialItemsField commit={commit} items={blockProps.items} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupStyle}>
            <SelectField
              label={labels.fieldSocialIconStyle}
              commit={commit}
              value={blockProps.iconStyle}
              propKey="iconStyle"
              options={[
                { value: "logo", label: labels.socialIconStyleLogo },
                { value: "filled", label: labels.socialIconStyleFilled },
                {
                  value: "filled-color",
                  label: labels.socialIconStyleFilledColor,
                },
                { value: "no-color", label: labels.socialIconStyleNoColor },
              ]}
            />
            {/* Each field below only exists for the styles it actually affects — a
                shape/color/tone that does nothing for the current icon style is noise,
                not a setting. Which fields show is a pure function of iconStyle, so the
                layout for a given style is always identical, never shifting underfoot. */}
            {blockProps.iconStyle === "filled" ||
            blockProps.iconStyle === "filled-color" ? (
              <SelectField
                label={labels.fieldSocialShape}
                commit={commit}
                value={blockProps.shape}
                propKey="shape"
                options={[
                  { value: "circle", label: labels.socialShapeCircle },
                  { value: "square", label: labels.socialShapeSquare },
                  { value: "rounded", label: labels.socialShapeRounded },
                ]}
              />
            ) : null}
            {blockProps.iconStyle === "filled-color" ||
            blockProps.iconStyle === "no-color" ? (
              <div className="donativus-vb-field-row">
                {blockProps.iconStyle === "filled-color" ? (
                  <ColorField
                    label={labels.fieldColor}
                    commit={commit}
                    value={blockProps.color}
                    propKey="color"
                  />
                ) : null}
                <SelectField
                  label={labels.fieldSocialGlyphTone}
                  commit={commit}
                  value={blockProps.glyphTone}
                  propKey="glyphTone"
                  options={[
                    { value: "light", label: labels.socialGlyphToneLight },
                    { value: "dark", label: labels.socialGlyphToneDark },
                  ]}
                />
              </div>
            ) : null}
            <NumberField
              label={labels.fieldSocialIconSize}
              commit={commit}
              value={blockProps.iconSizePx}
              propKey="iconSizePx"
              min={12}
              max={96}
            />
            <NumberField
              label={labels.fieldSocialGap}
              commit={commit}
              value={blockProps.gapPx}
              propKey="gapPx"
              min={0}
              max={200}
            />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <SpacingFields commit={commit} value={blockProps.spacing} />
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    case "spacer": {
      const blockProps = node.props as SpacerProps;
      return (
        <>
          <InspectorGroup title={labels.groupStyle}>
            <NumberField
              label={labels.fieldHeight}
              commit={commit}
              value={blockProps.heightPx}
              propKey="heightPx"
            />
            <WidthField
              label={labels.fieldWidth}
              commit={commit}
              value={blockProps.width}
              propKey="width"
            />
            <AlignField commit={commit} value={blockProps.align} />
          </InspectorGroup>
          <InspectorGroup title={labels.groupSpacing}>
            <MarginFields commit={commit} value={blockProps.margin} />
          </InspectorGroup>
        </>
      );
    }
    default:
      return (
        <p className="donativus-vb-empty-hint" role="note">
          {labels.unsupportedBlock(node.type)}
        </p>
      );
  }
}

function DocumentSettingsInspector(): React.JSX.Element {
  const document = useDocument();
  const actions = useBuilderActions();
  const { labels } = useBuilderMeta();
  const settings = document.settings;
  const commit: FieldCommit = (patch) => {
    const result = actions.dispatch({
      type: "update-document-settings",
      settings: { ...document.settings, ...patch },
    });
    return result.ok ? [] : result.issues;
  };
  const linkCommit: FieldCommit = (patch) =>
    commit({ linkStyle: { ...settings.linkStyle, ...patch } });

  return (
    <>
      <InspectorGroup title={labels.groupDocument}>
        <TextField
          label={labels.fieldLanguage}
          commit={commit}
          value={settings.language}
          propKey="language"
        />
        {document.mode === "email" ? (
          <TextField
            label={labels.fieldPreviewText}
            commit={commit}
            value={(settings as VisualDocumentEmailSettings).previewText}
            propKey="previewText"
            helpText={labels.fieldPreviewTextHelp}
          />
        ) : (
          <>
            <TextField
              label={labels.fieldPageTitle}
              commit={commit}
              value={(settings as VisualDocumentLandingPageSettings).title}
              propKey="title"
            />
            <TextField
              label={labels.fieldMetaDescription}
              commit={(patch) =>
                commit({
                  metaDescription:
                    patch.metaDescription === "" ? null : patch.metaDescription,
                })
              }
              value={
                (settings as VisualDocumentLandingPageSettings)
                  .metaDescription ?? ""
              }
              propKey="metaDescription"
            />
            <TextField
              label={labels.fieldFaviconUrl}
              commit={(patch) =>
                commit({
                  faviconUrl: patch.faviconUrl === "" ? null : patch.faviconUrl,
                })
              }
              value={
                (settings as VisualDocumentLandingPageSettings).faviconUrl ?? ""
              }
              propKey="faviconUrl"
            />
          </>
        )}
        <ColorField
          label={labels.fieldBodyBackground}
          commit={commit}
          value={
            document.mode === "email"
              ? (settings as VisualDocumentEmailSettings).canvasBackgroundColor
              : (settings as VisualDocumentLandingPageSettings)
                  .pageBackgroundColor
          }
          propKey={
            document.mode === "email"
              ? "canvasBackgroundColor"
              : "pageBackgroundColor"
          }
        />
        <WidthField
          label={labels.fieldContentWidth}
          commit={commit}
          value={settings.contentWidth}
          propKey="contentWidth"
        />
        <AlignField
          commit={commit}
          value={settings.contentAlign}
          propKey="contentAlign"
        />
      </InspectorGroup>
      <InspectorGroup title={labels.groupSpacing}>
        <SpacingFields commit={commit} value={settings.spacing} />
      </InspectorGroup>
      <InspectorGroup title={labels.groupLink}>
        <ColorField
          label={labels.fieldLinkColor}
          commit={linkCommit}
          value={settings.linkStyle.color}
          propKey="color"
        />
        <ToggleField
          label={labels.fieldUnderlineLinks}
          commit={linkCommit}
          value={settings.linkStyle.underline}
          propKey="underline"
        />
      </InspectorGroup>
    </>
  );
}

export function Inspector(): React.JSX.Element {
  const selectedNodeId = useSelectedNodeId();
  const { labels } = useBuilderMeta();
  return (
    <aside
      className="donativus-vb-inspector bg-base-100 border-base-300"
      aria-label={labels.inspectorTitle}
      data-vb-inspector
      tabIndex={-1}
    >
      <h2 className="donativus-vb-inspector-title">
        {selectedNodeId ? labels.inspectorTitle : labels.documentSettingsTitle}
        {selectedNodeId && <SelectedBlockName nodeId={selectedNodeId} />}
      </h2>
      {selectedNodeId ? (
        <SelectedNodeInspector nodeId={selectedNodeId} />
      ) : (
        <DocumentSettingsInspector />
      )}
    </aside>
  );
}

function SelectedBlockName({
  nodeId,
}: {
  nodeId: string;
}): React.JSX.Element | null {
  const node = useNode(nodeId);
  const { labels } = useBuilderMeta();
  if (!node) return null;
  return (
    <span className="badge badge-ghost donativus-vb-inspector-block-name">
      {blockDisplayName(labels, node.type)}
    </span>
  );
}

function SelectedNodeInspector({
  nodeId,
}: {
  nodeId: string;
}): React.JSX.Element | null {
  const node = useNode(nodeId);
  if (!node) return null;
  return <NodeInspector key={nodeId} node={node} />;
}
