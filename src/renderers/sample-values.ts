import type {
  RichTextInlineNode,
  RichTextLinkChildNode,
  RichTextValue,
  TemplatedValue,
  VisualBuilderNode,
  VisualDocument,
} from "../types/index.js";
import type { VariableRegistry } from "../core/registry/types.js";

function replaceVariable(
  node: RichTextLinkChildNode,
  variables: VariableRegistry,
): RichTextLinkChildNode {
  if (node.type !== "variable") return node;
  const definition = variables.get(node.variableKey);
  if (
    !definition ||
    definition.token !== node.token ||
    definition.sampleValue === undefined ||
    !definition.allowedContexts.includes("text")
  ) {
    return node;
  }
  return {
    type: "text",
    text: definition.sampleValue,
    marks: node.marks ?? [],
  };
}

function replaceInlineNode(
  node: RichTextInlineNode,
  variables: VariableRegistry,
): RichTextInlineNode {
  if (node.type === "variable" || node.type === "text") {
    return replaceVariable(node, variables);
  }
  if (node.type === "link") {
    return {
      ...node,
      children: node.children.map((child) => replaceVariable(child, variables)),
    };
  }
  return node;
}

function replaceRichTextSamples(
  value: RichTextValue,
  variables: VariableRegistry,
): RichTextValue {
  return {
    ...value,
    children: value.children.map((node) =>
      node.type === "paragraph"
        ? {
            ...node,
            children: node.children.map((child) =>
              replaceInlineNode(child, variables),
            ),
          }
        : {
            ...node,
            children: node.children.map((item) => ({
              ...item,
              children: item.children.map((child) =>
                replaceInlineNode(child, variables),
              ),
            })),
          },
    ),
  };
}

function replaceTemplatedValueSamples(
  value: TemplatedValue,
  variables: VariableRegistry,
): TemplatedValue {
  return {
    segments: value.segments.map((segment) => {
      if (segment.kind !== "variable") return segment;
      const definition = variables.get(segment.variableKey);
      if (
        !definition ||
        definition.token !== segment.token ||
        definition.sampleValue === undefined
      ) {
        return segment;
      }
      return { kind: "literal", value: definition.sampleValue };
    }),
  };
}

function replaceNodeSamples(
  node: VisualBuilderNode,
  variables: VariableRegistry,
): VisualBuilderNode {
  if ("unavailable" in node) return node;
  switch (node.type) {
    case "heading":
      return {
        ...node,
        props: {
          ...node.props,
          text: replaceRichTextSamples(node.props.text, variables),
        },
      };
    case "rich-text":
      return {
        ...node,
        props: {
          ...node.props,
          value: replaceRichTextSamples(node.props.value, variables),
        },
      };
    case "cta":
      return {
        ...node,
        props: {
          ...node.props,
          label: replaceRichTextSamples(node.props.label, variables),
          destination: replaceTemplatedValueSamples(
            node.props.destination,
            variables,
          ),
        },
      };
    case "image":
      return {
        ...node,
        props: {
          ...node.props,
          link: node.props.link
            ? replaceTemplatedValueSamples(node.props.link, variables)
            : null,
        },
      };
    default:
      return node;
  }
}

/** Creates an ephemeral render-only document. Canonical JSON and durable state always retain exact variable tokens. */
export function createSamplePreviewDocument(
  document: VisualDocument,
  variables: VariableRegistry,
): VisualDocument {
  return {
    ...document,
    nodes: Object.fromEntries(
      Object.entries(document.nodes).map(([id, node]) => [
        id,
        replaceNodeSamples(node, variables),
      ]),
    ),
  };
}
