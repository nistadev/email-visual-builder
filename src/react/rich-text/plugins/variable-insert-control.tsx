import type { VariableDefinition } from "../../../types/index.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type LexicalEditor,
} from "lexical";
import { $createVariableNode } from "../variable-node.js";
import { VariableTokenMenu } from "../../variable-token-menu.js";

export function VariableInsertControl({
  variables,
  label,
  searchPlaceholder,
  noMatchesLabel,
  getEditor,
}: {
  variables: readonly VariableDefinition[];
  label: string;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
  getEditor: () => LexicalEditor | null;
}): React.JSX.Element | null {
  const textVariables = variables.filter((definition) =>
    definition.allowedContexts.includes("text"),
  );

  const insert = (definition: VariableDefinition): void => {
    const editor = getEditor();
    if (!editor) return;
    editor.update(() => {
      if (!$isRangeSelection($getSelection())) $getRoot().selectEnd();
      $insertNodes([
        $createVariableNode(
          definition.key,
          definition.token,
          definition.label,
          definition.sampleValue ?? null,
          true,
          [],
        ),
      ]);
    });
    editor.focus();
  };

  return (
    <VariableTokenMenu
      variables={textVariables}
      label={label}
      searchPlaceholder={searchPlaceholder}
      noMatchesLabel={noMatchesLabel}
      onSelect={insert}
    />
  );
}

export function VariableInsertControlPlugin({
  variables,
  label,
  searchPlaceholder,
  noMatchesLabel,
}: {
  variables: readonly VariableDefinition[];
  label: string;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  return (
    <VariableInsertControl
      variables={variables}
      label={label}
      searchPlaceholder={searchPlaceholder}
      noMatchesLabel={noMatchesLabel}
      getEditor={() => editor}
    />
  );
}
