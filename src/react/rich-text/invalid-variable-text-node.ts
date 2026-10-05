// A plain `TextNode` subclass used only for visual decoration of typed text
// that matches the configured variable syntax but was never inserted as an
// atomic `VariableNode` (design.md decision #8, task 11.3). It carries no
// extra semantic data and is not a distinct AST node type — converting it
// back to the AST produces an ordinary text segment, which is exactly what
// lets the core's `checkLiteralTextForUnresolvedVariables` (section 7) flag
// it as a blocking export error identifying its location.

import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
} from "lexical";
import { $applyNodeReplacement, TextNode } from "lexical";

export class InvalidVariableTextNode extends TextNode {
  static getType(): string {
    return "donativus-invalid-variable-text";
  }

  static clone(node: InvalidVariableTextNode): InvalidVariableTextNode {
    return new InvalidVariableTextNode(node.__text, node.__key);
  }

  constructor(text: string, key?: NodeKey) {
    super(text, key);
  }

  static importJSON(
    serializedNode: SerializedTextNode,
  ): InvalidVariableTextNode {
    const node = $createInvalidVariableTextNode(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setStyle(serializedNode.style);
    return node;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.classList.add("donativus-vb-invalid-variable-text");
    dom.title = "Unresolved variable-like text";
    return dom;
  }
}

export function $createInvalidVariableTextNode(
  text: string,
): InvalidVariableTextNode {
  return $applyNodeReplacement(new InvalidVariableTextNode(text));
}

export function $isInvalidVariableTextNode(
  node: LexicalNode | null | undefined,
): node is InvalidVariableTextNode {
  return node instanceof InvalidVariableTextNode;
}
