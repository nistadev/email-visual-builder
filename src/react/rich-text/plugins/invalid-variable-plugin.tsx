import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalTextEntity } from "@lexical/react/useLexicalTextEntity";
import type { TextNode } from "lexical";
import { useCallback, useEffect, useMemo } from "react";
import type { VariableRegistry } from "../../../core/registry/types.js";
import {
  $createInvalidVariableTextNode,
  InvalidVariableTextNode,
} from "../invalid-variable-text-node.js";
import { $createVariableNode } from "../variable-node.js";

export interface InvalidVariablePluginProps {
  registry: VariableRegistry;
}

export function InvalidVariablePlugin({
  registry,
}: InvalidVariablePluginProps): null {
  const [editor] = useLexicalComposerContext();
  const textVariables = useMemo(
    () =>
      new Map(
        registry
          .list()
          .filter((definition) => definition.allowedContexts.includes("text"))
          .map((definition) => [definition.token, definition]),
      ),
    [registry],
  );
  const getMatch = useCallback(
    (text: string) => {
      const pattern = new RegExp(
        registry.syntax.pattern.source,
        registry.syntax.pattern.flags.replace("g", ""),
      );
      const match = pattern.exec(text);
      if (!match) return null;
      return { start: match.index, end: match.index + match[0].length };
    },
    [registry],
  );

  const createNode = useCallback(
    (textNode: TextNode) =>
      $createInvalidVariableTextNode(textNode.getTextContent()),
    [],
  );

  useLexicalTextEntity(getMatch, InvalidVariableTextNode, createNode);

  useEffect(
    () =>
      editor.registerNodeTransform(InvalidVariableTextNode, (node) => {
        const definition = textVariables.get(node.getTextContent());
        if (!definition) return;
        node.replace(
          $createVariableNode(
            definition.key,
            definition.token,
            definition.label,
            definition.sampleValue ?? null,
            true,
          ),
        );
      }),
    [editor, textVariables],
  );

  return null;
}
