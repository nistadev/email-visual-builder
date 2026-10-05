// Searchable variable insertion (design.md decision #8, task 11.3). Typing
// the trigger character (`%` by default, matching the default variable
// syntax) opens a filterable menu of the injected variable definitions;
// choosing one inserts an atomic `VariableNode` in place of the typed query.

import type { VariableDefinition } from "../../../types/index.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useCallback, useMemo, useState } from "react";
import { createScopedPortal } from "../../scope.js";
import { $createVariableNode } from "../variable-node.js";

class VariableMenuOption extends MenuOption {
  definition: VariableDefinition;
  constructor(definition: VariableDefinition) {
    super(definition.key);
    this.definition = definition;
  }
}

export interface VariablePickerPluginProps {
  variables: readonly VariableDefinition[];
  /** The character that opens the picker — defaults to `%` to match the default variable syntax. */
  trigger?: string;
}

export function VariablePickerPlugin({
  variables,
  trigger = "%",
}: VariablePickerPluginProps): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(trigger, {
    minLength: 0,
  });

  const options = useMemo(() => {
    const query = (queryString ?? "").toLowerCase();
    return variables
      .filter(
        (definition) =>
          definition.label.toLowerCase().includes(query) ||
          definition.key.toLowerCase().includes(query),
      )
      .map((definition) => new VariableMenuOption(definition))
      .slice(0, 20);
  }, [queryString, variables]);

  const onSelectOption = useCallback(
    (
      option: VariableMenuOption,
      nodeToReplace: Parameters<
        Parameters<typeof LexicalTypeaheadMenuPlugin>[0]["onSelectOption"]
      >[1],
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const variableNode = $createVariableNode(
          option.definition.key,
          option.definition.token,
          option.definition.label,
          option.definition.sampleValue ?? null,
          true,
          [],
        );
        if (nodeToReplace) nodeToReplace.replace(variableNode);
        closeMenu();
      });
    },
    [editor],
  );

  if (variables.length === 0) return null;

  return (
    <LexicalTypeaheadMenuPlugin<VariableMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (!anchorElementRef.current || options.length === 0) return null;
        return createScopedPortal(
          <ul className="donativus-vb-variable-menu" role="listbox">
            {options.map((option, index) => (
              <li
                key={option.key}
                role="option"
                aria-selected={selectedIndex === index}
                className={
                  selectedIndex === index
                    ? "donativus-vb-variable-menu-item donativus-vb-variable-menu-item--active"
                    : "donativus-vb-variable-menu-item"
                }
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOptionAndCleanUp(option)}
              >
                {option.definition.label}
              </li>
            ))}
          </ul>,
          anchorElementRef.current,
        );
      }}
    />
  );
}
