// The atomic, one-unit cursor/delete token-mode variable node (design.md
// decision #8, task 11.3). Never a decorated string match — a
// `RichTextVariableNode` in the AST always round-trips through exactly one
// `VariableNode` instance, never through plain text.

import type {
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { createContext, useContext } from "react";
import type { RichTextMark } from "../../types/index.js";

export type VariablePreviewMode = "token" | "sample";

/** Toggles every `VariableNode`'s chip between its exact token and its configured sample value — set by a consumer (section 12's preview toggle) wrapping the editor tree. */
export const VariablePreviewModeContext =
  createContext<VariablePreviewMode>("token");

export type SerializedVariableNode = Spread<
  {
    variableKey: string;
    token: string;
    label: string;
    sampleValue: string | null;
    /** `false` when the persisted token no longer matches (or the key no longer exists in) the active variable registry — renders the "invalid" chip style. */
    resolved: boolean;
    marks: RichTextMark[];
  },
  SerializedLexicalNode
>;

function VariableChip(props: {
  label: string;
  token: string;
  sampleValue: string | null;
  resolved: boolean;
  marks: readonly RichTextMark[];
}): React.JSX.Element {
  const previewMode = useContext(VariablePreviewModeContext);
  const display =
    previewMode === "sample" && props.sampleValue
      ? props.sampleValue
      : props.token;
  return (
    <span
      className={`donativus-vb-variable-chip${props.resolved ? "" : " donativus-vb-variable-chip--invalid"}`}
      data-token={props.token}
      title={props.resolved ? props.token : `Unknown variable: ${props.token}`}
    >
      {props.marks.includes("bold") ? <strong>{display}</strong> : display}
    </span>
  );
}

export class VariableNode extends DecoratorNode<React.JSX.Element> {
  __variableKey: string;
  __token: string;
  __label: string;
  __sampleValue: string | null;
  __resolved: boolean;
  __marks: readonly RichTextMark[];

  static getType(): string {
    return "donativus-variable";
  }

  static clone(node: VariableNode): VariableNode {
    return new VariableNode(
      node.__variableKey,
      node.__token,
      node.__label,
      node.__sampleValue,
      node.__resolved,
      node.__key,
      node.__marks,
    );
  }

  constructor(
    variableKey: string,
    token: string,
    label: string,
    sampleValue: string | null,
    resolved: boolean,
    key?: NodeKey,
    marks: readonly RichTextMark[] = [],
  ) {
    super(key);
    this.__variableKey = variableKey;
    this.__token = token;
    this.__label = label;
    this.__sampleValue = sampleValue;
    this.__resolved = resolved;
    this.__marks = marks;
  }

  static importJSON(serializedNode: SerializedVariableNode): VariableNode {
    return $createVariableNode(
      serializedNode.variableKey,
      serializedNode.token,
      serializedNode.label,
      serializedNode.sampleValue,
      serializedNode.resolved,
      serializedNode.marks ?? [],
    );
  }

  exportJSON(): SerializedVariableNode {
    return {
      type: "donativus-variable",
      version: 1,
      variableKey: this.__variableKey,
      token: this.__token,
      label: this.__label,
      sampleValue: this.__sampleValue,
      resolved: this.__resolved,
      marks: [...this.__marks],
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  isKeyboardSelectable(): true {
    return true;
  }

  getTextContent(): string {
    return this.__token;
  }

  decorate(): React.JSX.Element {
    return (
      <VariableChip
        label={this.__label}
        token={this.__token}
        sampleValue={this.__sampleValue}
        resolved={this.__resolved}
        marks={this.__marks}
      />
    );
  }
}

export function $createVariableNode(
  variableKey: string,
  token: string,
  label: string,
  sampleValue: string | null,
  resolved: boolean,
  marks: readonly RichTextMark[] = [],
): VariableNode {
  return $applyNodeReplacement(
    new VariableNode(
      variableKey,
      token,
      label,
      sampleValue,
      resolved,
      undefined,
      marks,
    ),
  );
}

export function $isVariableNode(
  node: LexicalNode | null | undefined,
): node is VariableNode {
  return node instanceof VariableNode;
}
