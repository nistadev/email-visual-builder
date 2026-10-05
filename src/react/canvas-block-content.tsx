// Authored-content previews for the built-in blocks (task 12.3). These are
// canvas presentations only — export HTML always comes from the pure
// renderers, never from this DOM. User-authored colors/dimensions are
// document data applied as inline styles inside the isolated
// `.donativus-vb-authored` surface; they are never chrome classes
// (design.md decision #13).

import type {
  CtaProps,
  DividerProps,
  HeadingProps,
  ImageProps,
  RichTextInlineNode,
  RichTextProps,
  RichTextValue,
  SectionProps,
  ShadowValue,
  SocialProps,
  SpacerProps,
  SpacingValue,
  TemplatedValue,
  TypographyValue,
  VariableDefinition,
  VisualBuilderNode,
} from "../types/index.js";
import type { LexicalEditor } from "lexical";
import { ImageIcon } from "lucide-react";
import {
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { SocialIconPlatform } from "../core/blocks/social-icon-assets.generated.js";
import { shadowStyleValue } from "../renderers/style.js";
import { resolveSocialItemStyle } from "../renderers/social-icon-style.js";
import { useSelectedNodeId } from "./node-helpers.js";
import {
  useBuilderMeta,
  useBuilderSelector,
  useEditorChrome,
} from "./provider.js";
import { createRichTextCommitHandler } from "./rich-text/controller-commit.js";
import { RichTextEditor } from "./rich-text/RichTextEditor.js";

export function spacingToStyle(spacing: SpacingValue): CSSProperties {
  return {
    padding: `${spacing.topPx}px ${spacing.rightPx}px ${spacing.bottomPx}px ${spacing.leftPx}px`,
  };
}

export function typographyToStyle(typography: TypographyValue): CSSProperties {
  const fontWeight = {
    thin: 100,
    normal: 400,
    semibold: 600,
    bold: 700,
  }[typography.fontWeight];
  return {
    fontFamily: typography.fontFamily,
    fontSize: `${typography.fontSizePx}px`,
    lineHeight: `${typography.lineHeightPercent}%`,
    letterSpacing: `${typography.letterSpacingPx}px`,
    fontWeight,
    color: typography.color,
  };
}

export function shadowToStyle(shadow: ShadowValue | null): CSSProperties {
  return shadow ? { boxShadow: shadowStyleValue(shadow) } : {};
}

/**
 * The canvas keeps margin inside the selectable node so its transparent space
 * remains visible and inspectable. Export renderers still emit real external
 * CSS margin; this wrapper is editor-only presentation.
 */
function CanvasMargin({
  value,
  children,
}: {
  value: SpacingValue;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div data-vb-canvas-margin style={spacingToStyle(value)}>
      {children}
    </div>
  );
}

function useVariableChipText(): (variableKey: string, token: string) => string {
  const { variables } = useBuilderMeta();
  const { variablePreviewMode } = useEditorChrome();
  return (variableKey: string, token: string): string => {
    const definition: VariableDefinition | undefined = variables.find(
      (candidate) => candidate.key === variableKey,
    );
    if (
      variablePreviewMode === "sample" &&
      definition?.sampleValue !== undefined
    )
      return definition.sampleValue;
    return token;
  };
}

/** Renders a `TemplatedValue` inline: literals as text, variables as labeled chips (token/sample per the toolbar toggle). */
export function TemplatedText({
  value,
}: {
  value: TemplatedValue;
}): React.JSX.Element {
  const chipText = useVariableChipText();
  return (
    <>
      {value.segments.map((segment, index) =>
        segment.kind === "literal" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <span
            key={index}
            className="donativus-vb-variable-chip"
            data-vb-variable={segment.variableKey}
          >
            {chipText(segment.variableKey, segment.token)}
          </span>
        ),
      )}
    </>
  );
}

function InlineNodes({
  nodes,
}: {
  nodes: readonly RichTextInlineNode[];
}): React.JSX.Element {
  const chipText = useVariableChipText();
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case "text": {
            const style: CSSProperties = {};
            if (node.color !== undefined) style.color = node.color;
            if (node.highlightColor !== undefined)
              style.backgroundColor = node.highlightColor;
            if (node.fontFamily !== undefined)
              style.fontFamily = node.fontFamily;
            let content: ReactNode = node.text;
            if (node.marks.includes("bold"))
              content = <strong>{content}</strong>;
            if (node.marks.includes("italic")) content = <em>{content}</em>;
            if (node.marks.includes("underline")) content = <u>{content}</u>;
            if (node.marks.includes("strikethrough"))
              content = <s>{content}</s>;
            return (
              <span key={index} style={style}>
                {content}
              </span>
            );
          }
          case "variable": {
            let content: ReactNode = chipText(node.variableKey, node.token);
            if (node.marks?.includes("bold"))
              content = <strong>{content}</strong>;
            if (node.marks?.includes("italic")) content = <em>{content}</em>;
            if (node.marks?.includes("underline")) content = <u>{content}</u>;
            if (node.marks?.includes("strikethrough"))
              content = <s>{content}</s>;
            return (
              <span
                key={index}
                className="donativus-vb-variable-chip"
                data-vb-variable={node.variableKey}
              >
                {content}
              </span>
            );
          }
          case "break":
            return <br key={index} />;
          case "link":
            // Canvas preview: links render as styled text, never navigable — the canvas is not a browsing surface.
            return (
              <span key={index} className="donativus-vb-canvas-link">
                <InlineNodes nodes={node.children} />
              </span>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

export function StaticRichText({
  value,
}: {
  value: RichTextValue;
}): React.JSX.Element {
  return (
    <>
      {value.children.map((node, index) => {
        switch (node.type) {
          case "paragraph":
            return (
              <p
                key={index}
                style={{ textAlign: node.align, margin: "0 0 12px 0" }}
              >
                <InlineNodes nodes={node.children} />
              </p>
            );
          case "bulleted-list":
          case "numbered-list": {
            const items = node.children.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineNodes nodes={item.children} />
              </li>
            ));
            return node.type === "bulleted-list" ? (
              <ul key={index}>{items}</ul>
            ) : (
              <ol key={index}>{items}</ol>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

function StaticInlineRichText({
  value,
}: {
  value: RichTextValue;
}): React.JSX.Element {
  const lines = value.children.flatMap((node) =>
    node.type === "paragraph"
      ? [node.children]
      : node.children.map((item) => item.children),
  );
  return (
    <>
      {lines.map((nodes, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          <InlineNodes nodes={nodes} />
        </span>
      ))}
    </>
  );
}

/** Canvas-native rich-text editing with the same controller coalescing and undo resync semantics as the inspector editor. */
function InlineRichTextEditor({
  nodeId,
  value,
  propKey = "value",
  ariaLabel,
  inline = false,
  editorRef,
}: {
  nodeId: string;
  value: RichTextValue;
  propKey?: "value" | "text" | "label";
  ariaLabel?: string;
  inline?: boolean;
  editorRef?: RefObject<LexicalEditor | null>;
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
    <div
      className={`donativus-vb-inline-rich-text${inline ? " is-inline" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <RichTextEditor
        key={nodeId}
        initialValue={documentValue ?? value}
        registry={registries.variables}
        variables={variables}
        previewMode={variablePreviewMode}
        ariaLabel={ariaLabel ?? labels.fieldText}
        placeholder={ariaLabel ?? labels.fieldText}
        contentEditableClassName={`donativus-vb-rich-text-content donativus-vb-rich-text-content--canvas${inline ? " donativus-vb-rich-text-content--inline" : ""}${propKey !== "value" ? " donativus-vb-rich-text-content--single-line" : ""}${propKey === "label" ? " donativus-vb-rich-text-content--button-label" : ""}`}
        autoFocus
        editorRef={editorRef}
        showFormattingToolbar
        allowLinks={propKey !== "label"}
        linkStyle={linkStyle}
        formattingLabels={labels}
        resyncToken={resyncTokenRef.current}
        onCommit={(nextValue) => {
          commitHandler(nextValue);
          const stored = (
            controller.getState().document.nodes[nodeId]?.props as
              Record<string, unknown> | undefined
          )?.[propKey] as RichTextValue | undefined;
          lastCommittedRef.current = stored ?? nextValue;
        }}
      />
    </div>
  );
}

/** The per-block authored preview. Containers receive their children pre-rendered (the recursive canvas owns chrome/slots). */
export function BlockContent({
  node,
  children,
  editorRef,
}: {
  node: VisualBuilderNode;
  children?: ReactNode;
  editorRef?: RefObject<LexicalEditor | null>;
}): React.JSX.Element | null {
  const selectedNodeId = useSelectedNodeId();
  const { labels } = useBuilderMeta();
  const isSelected = selectedNodeId === node.id;

  switch (node.type) {
    case "section": {
      const blockProps = node.props as SectionProps;
      const outerStyle: CSSProperties = {
        ...shadowToStyle(blockProps.shadow),
      };
      if (blockProps.background.color)
        outerStyle.backgroundColor = blockProps.background.color;
      const innerStyle: CSSProperties = {
        ...spacingToStyle(blockProps.spacing),
      };
      if (blockProps.contentWidth.unit === "px") {
        innerStyle.width = "100%";
        innerStyle.maxWidth = `${blockProps.contentWidth.value}px`;
      } else {
        innerStyle.width = `${blockProps.contentWidth.value}%`;
      }
      if (blockProps.align === "center") {
        innerStyle.marginInline = "auto";
      } else if (blockProps.align === "right") {
        innerStyle.marginInlineStart = "auto";
      } else {
        innerStyle.marginInlineEnd = "auto";
      }
      return (
        <CanvasMargin value={blockProps.margin}>
          <div style={outerStyle}>
            <div style={innerStyle}>{children}</div>
          </div>
        </CanvasMargin>
      );
    }
    case "columns": {
      const blockProps = node.props as {
        columnWidthRatios: number[];
        responsiveStack: "stack" | "no-stack";
        spacing: SpacingValue;
        margin: SpacingValue;
      };
      return (
        <CanvasMargin value={blockProps.margin}>
          <div
            style={spacingToStyle(blockProps.spacing)}
            className="donativus-vb-canvas-columns"
            data-vb-responsive-stack={blockProps.responsiveStack}
          >
            {children}
          </div>
        </CanvasMargin>
      );
    }
    case "column": {
      const blockProps = node.props as {
        background: { color: string | null };
        spacing: SpacingValue;
        margin: SpacingValue;
      };
      const style: CSSProperties = {
        ...spacingToStyle(blockProps.spacing),
      };
      if (blockProps.background.color)
        style.backgroundColor = blockProps.background.color;
      return (
        <CanvasMargin value={blockProps.margin}>
          <div style={style}>{children}</div>
        </CanvasMargin>
      );
    }
    case "heading": {
      const blockProps = node.props as HeadingProps;
      const Tag = `h${blockProps.level}` as "h1";
      return (
        <CanvasMargin value={blockProps.margin}>
          <Tag
            style={{
              ...typographyToStyle(blockProps.typography),
              ...spacingToStyle(blockProps.spacing),
              textAlign: blockProps.align,
            }}
          >
            {isSelected ? (
              <InlineRichTextEditor
                nodeId={node.id}
                value={blockProps.text}
                propKey="text"
                ariaLabel={labels.fieldText}
                editorRef={editorRef}
              />
            ) : (
              <StaticInlineRichText value={blockProps.text} />
            )}
          </Tag>
        </CanvasMargin>
      );
    }
    case "rich-text": {
      const blockProps = node.props as RichTextProps;
      const borderRadius = blockProps.borderRadiusByCorner
        ? `${blockProps.borderTopLeftRadiusPx}px ${blockProps.borderTopRightRadiusPx}px ${blockProps.borderBottomRightRadiusPx}px ${blockProps.borderBottomLeftRadiusPx}px`
        : `${blockProps.borderRadiusPx}px`;
      return (
        <CanvasMargin value={blockProps.margin}>
          <div
            style={{
              ...typographyToStyle(blockProps.typography),
              ...spacingToStyle(blockProps.spacing),
              ...(blockProps.border
                ? {
                    border: `${blockProps.borderWidth}px solid ${blockProps.borderColor}`,
                    borderRadius,
                  }
                : {}),
            }}
          >
            {isSelected ? (
              <InlineRichTextEditor
                nodeId={node.id}
                value={blockProps.value}
                editorRef={editorRef}
              />
            ) : (
              <StaticRichText value={blockProps.value} />
            )}
          </div>
        </CanvasMargin>
      );
    }
    case "image": {
      const blockProps = node.props as ImageProps;
      const width =
        blockProps.displayWidth.unit === "percent"
          ? `${blockProps.displayWidth.value}%`
          : `${blockProps.displayWidth.value}px`;
      const borderRadius = blockProps.borderRadiusByCorner
        ? `${blockProps.borderTopLeftRadiusPx}px ${blockProps.borderTopRightRadiusPx}px ${blockProps.borderBottomRightRadiusPx}px ${blockProps.borderBottomLeftRadiusPx}px`
        : `${blockProps.borderRadiusPx}px`;
      return (
        <CanvasMargin value={blockProps.margin}>
          <div
            style={{
              ...spacingToStyle(blockProps.spacing),
              textAlign: blockProps.align,
            }}
          >
            {blockProps.asset ? (
              <img
                src={blockProps.asset.url}
                alt={blockProps.altText}
                style={{ width, maxWidth: "100%", borderRadius }}
              />
            ) : (
              <span
                className="donativus-vb-image-placeholder"
                style={{ width, maxWidth: "100%", borderRadius }}
                data-vb-image-placeholder
                aria-hidden="true"
              >
                <span className="donativus-vb-image-placeholder-icon">
                  <ImageIcon size={28} strokeWidth={1.5} />
                </span>
              </span>
            )}
          </div>
        </CanvasMargin>
      );
    }
    case "cta": {
      const blockProps = node.props as CtaProps;
      const style: CSSProperties = {
        ...typographyToStyle(blockProps.typography),
        ...spacingToStyle(blockProps.spacing),
        backgroundColor: blockProps.backgroundColor,
        borderRadius: `${blockProps.borderRadiusPx}px`,
        ...shadowToStyle(blockProps.shadow),
        display: "inline-block",
        textAlign: "center",
      };
      if (blockProps.width.unit !== "auto") {
        style.width =
          blockProps.width.unit === "percent"
            ? `${blockProps.width.value}%`
            : `${blockProps.width.value}px`;
      }
      return (
        <CanvasMargin value={blockProps.margin}>
          <div style={{ textAlign: blockProps.align }}>
            <span style={style}>
              {isSelected ? (
                <InlineRichTextEditor
                  nodeId={node.id}
                  value={blockProps.label}
                  propKey="label"
                  ariaLabel={labels.fieldLabel}
                  inline={blockProps.width.unit === "auto"}
                  editorRef={editorRef}
                />
              ) : (
                <StaticInlineRichText value={blockProps.label} />
              )}
            </span>
          </div>
        </CanvasMargin>
      );
    }
    case "divider": {
      const blockProps = node.props as DividerProps;
      const width =
        blockProps.width.unit === "percent"
          ? `${blockProps.width.value}%`
          : `${blockProps.width.value}px`;
      const margin =
        blockProps.align === "center"
          ? "0 auto"
          : blockProps.align === "right"
            ? "0 0 0 auto"
            : "0 auto 0 0";
      return (
        <CanvasMargin value={blockProps.margin}>
          <div style={spacingToStyle(blockProps.spacing)}>
            <hr
              style={{
                borderTop: `${blockProps.thicknessPx}px ${blockProps.style} ${blockProps.color}`,
                borderBottom: "none",
                width,
                margin,
              }}
            />
          </div>
        </CanvasMargin>
      );
    }
    case "spacer": {
      const blockProps = node.props as SpacerProps;
      const width =
        blockProps.width.unit === "percent"
          ? `${blockProps.width.value}%`
          : `${blockProps.width.value}px`;
      const margin =
        blockProps.align === "center"
          ? "0 auto"
          : blockProps.align === "right"
            ? "0 0 0 auto"
            : "0 auto 0 0";
      return (
        <CanvasMargin value={blockProps.margin}>
          <div
            className="donativus-vb-spacer-preview"
            style={{ height: `${blockProps.heightPx}px`, width, margin }}
            aria-hidden="true"
          />
        </CanvasMargin>
      );
    }
    case "social": {
      const blockProps = node.props as SocialProps;
      const justify =
        blockProps.align === "center"
          ? "center"
          : blockProps.align === "right"
            ? "flex-end"
            : "flex-start";
      return (
        <CanvasMargin value={blockProps.margin}>
          <div
            style={{
              ...spacingToStyle(blockProps.spacing),
              display: "flex",
              flexWrap: "wrap",
              gap: `${blockProps.gapPx}px`,
              justifyContent: justify,
            }}
          >
            {blockProps.items.map((item) => {
              const style = resolveSocialItemStyle(
                item.platform as SocialIconPlatform,
                blockProps.iconStyle,
                blockProps.shape,
                blockProps.iconSizePx,
                blockProps.color,
                blockProps.glyphTone,
              );
              return (
                <span
                  key={item.id}
                  style={{
                    width: `${style.wrapperSizePx}px`,
                    height: `${style.wrapperSizePx}px`,
                    backgroundColor: style.backgroundColor ?? undefined,
                    borderRadius: style.borderRadiusCss,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={style.imgSrc}
                    alt={item.platform}
                    style={{ width: style.imgSizePx, height: style.imgSizePx }}
                  />
                </span>
              );
            })}
          </div>
        </CanvasMargin>
      );
    }
    default:
      // document-root and containers without dedicated presentation.
      return <>{children}</>;
  }
}
