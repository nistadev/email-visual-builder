import type { RichTextMark, VariableDefinition } from "../../../types/index.js";
import { $isLinkNode, type LinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelectionStyleValueForProperty } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import {
  Bold,
  Italic,
  Link2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Unlink,
} from "lucide-react";
import { createScopedPortal } from "../../scope.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FONT_CATALOGUE,
  FONT_GROUPS,
  type FontGroup,
} from "../../../core/fonts.js";
import { VariableTokenMenu } from "../../variable-token-menu.js";
import {
  clearFormatting,
  setFontFamily,
  setForegroundColor,
  toggleLink,
  toggleMark,
} from "../formatting-commands.js";

export interface RichTextFormattingLabels {
  addVariable: string;
  searchVariables: string;
  noVariableMatches: string;
  addLink: string;
  applyLink: string;
  removeLink: string;
  fieldDestination: string;
  formatBold: string;
  formatItalic: string;
  formatUnderline: string;
  formatStrikethrough: string;
  formatTextColor: string;
  formatFontFamily: string;
  formatFontDefault: string;
  formatClear: string;
  fontGroupSansSerif: string;
  fontGroupSerif: string;
  fontGroupMonospace: string;
  fontGroupScript: string;
}

const FONT_GROUP_LABEL_KEYS: Record<FontGroup, keyof RichTextFormattingLabels> =
  {
    "sans-serif": "fontGroupSansSerif",
    serif: "fontGroupSerif",
    monospace: "fontGroupMonospace",
    script: "fontGroupScript",
  };
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

interface ToolbarState {
  visible: boolean;
  left: number;
  top: number;
  placement: "above" | "below";
  activeMarks: readonly RichTextMark[];
  linkUrl: string | null;
  /** Empty when the selection has no own value or mixes several. */
  color: string;
  fontFamily: string;
}

const HIDDEN_TOOLBAR: ToolbarState = {
  visible: false,
  left: 0,
  top: 0,
  placement: "above",
  activeMarks: [],
  linkUrl: null,
  color: "",
  fontFamily: "",
};

function findLink(node: LexicalNode): LinkNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isLinkNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

function readSelection(editor: LexicalEditor): {
  visible: boolean;
  activeMarks: readonly RichTextMark[];
  linkUrl: string | null;
  linkKey: string | null;
  color: string;
  fontFamily: string;
  selection: RangeSelection | null;
} {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return {
        visible: false,
        activeMarks: [],
        linkUrl: null,
        linkKey: null,
        color: "",
        fontFamily: "",
        selection: null,
      };
    }
    const link =
      findLink(selection.anchor.getNode()) ??
      findLink(selection.focus.getNode()) ??
      selection.getNodes().map(findLink).find(Boolean) ??
      null;
    const activeMarks: RichTextMark[] = [];
    for (const mark of [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ] as const) {
      if (selection.hasFormat(mark)) activeMarks.push(mark);
    }
    return {
      visible: !selection.isCollapsed() || link !== null,
      activeMarks,
      linkUrl: link?.getURL() ?? null,
      linkKey: link?.getKey() ?? null,
      color: $getSelectionStyleValueForProperty(selection, "color", ""),
      fontFamily: $getSelectionStyleValueForProperty(
        selection,
        "font-family",
        "",
      ),
      selection: selection.clone(),
    };
  });
}

function selectionRect(
  editor: LexicalEditor,
  linkKey: string | null,
): DOMRect | null {
  const root = editor.getRootElement();
  const nativeSelection = globalThis.getSelection?.();
  if (
    root &&
    nativeSelection?.rangeCount &&
    nativeSelection.anchorNode &&
    root.contains(nativeSelection.anchorNode)
  ) {
    const range = nativeSelection.getRangeAt(0);
    try {
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    } catch {
      // Some non-layout DOMs expose Range but cannot measure it. The root
      // fallback below keeps the toolbar functional without leaking an error.
    }
  }
  const linkElement = linkKey ? editor.getElementByKey(linkKey) : null;
  try {
    return (linkElement ?? root)?.getBoundingClientRect() ?? null;
  } catch {
    return null;
  }
}

export function FloatingFormattingToolbarPlugin({
  variables,
  allowLinks,
  labels,
}: {
  variables: readonly VariableDefinition[];
  allowLinks: boolean;
  labels: RichTextFormattingLabels;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [toolbar, setToolbar] = useState<ToolbarState>(HIDDEN_TOOLBAR);
  const [linkInspectorOpen, setLinkInspectorOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const frameRef = useRef<number | null>(null);
  const selectionRef = useRef<RangeSelection | null>(null);
  const urlVariables = variables.filter((definition) =>
    definition.allowedContexts.includes("url"),
  );

  const refresh = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      // Lexical dispatches its selection-change command before the DOM range
      // is committed. Reading on the next frame keeps the model and native
      // selection aligned, which is essential for positioning this toolbar.
      const selection = readSelection(editor);
      selectionRef.current = selection.selection;
      if (!selection.visible) {
        setToolbar(HIDDEN_TOOLBAR);
        return;
      }
      const rect = selectionRect(editor, selection.linkKey);
      if (!rect) return;
      const placement = rect.top < 72 ? "below" : "above";
      setToolbar({
        visible: true,
        left: Math.min(
          Math.max(rect.left + rect.width / 2, 12),
          window.innerWidth - 12,
        ),
        top: placement === "above" ? rect.top - 8 : rect.bottom + 8,
        placement,
        activeMarks: selection.activeMarks,
        linkUrl: selection.linkUrl,
        color: selection.color,
        fontFamily: selection.fontFamily,
      });
    });
  }, [editor]);

  useEffect(() => {
    refresh();
    const onNativeSelectionChange = (): void => refresh();
    document.addEventListener("selectionchange", onNativeSelectionChange);
    const unregister = mergeRegister(
      editor.registerUpdateListener(refresh),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          refresh();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
    return () => {
      document.removeEventListener("selectionchange", onNativeSelectionChange);
      unregister();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [editor, refresh]);

  useEffect(() => {
    if (toolbar.linkUrl === null) return;
    setDestination(toolbar.linkUrl);
    setLinkInspectorOpen(true);
  }, [toolbar.linkUrl]);

  // A native select or color input takes focus, unlike the buttons, so the
  // range the author picked is put back before the style is applied.
  const restoreSelection = (): void => {
    editor.update(() => {
      if (selectionRef.current) $setSelection(selectionRef.current.clone());
    });
  };

  const applyLink = (value: string): void => {
    const next = value.trim();
    if (!next && toolbar.linkUrl === null) {
      setLinkInspectorOpen(false);
      return;
    }
    editor.update(() => {
      if (selectionRef.current) $setSelection(selectionRef.current.clone());
    });
    toggleLink(editor, next || null);
    setLinkInspectorOpen(false);
    setDestination("");
  };

  if (!toolbar.visible || typeof document === "undefined") return null;

  const formatButtons: readonly {
    mark: RichTextMark;
    label: string;
    icon: React.JSX.Element;
  }[] = [
    { mark: "bold", label: labels.formatBold, icon: <Bold size={14} /> },
    { mark: "italic", label: labels.formatItalic, icon: <Italic size={14} /> },
    {
      mark: "underline",
      label: labels.formatUnderline,
      icon: <Underline size={14} />,
    },
    {
      mark: "strikethrough",
      label: labels.formatStrikethrough,
      icon: <Strikethrough size={14} />,
    },
  ];

  return createScopedPortal(
    <div
      className={`donativus-vb-rich-text-toolbar bg-base-100 border-base-300 is-${toolbar.placement}`}
      style={{ left: `${toolbar.left}px`, top: `${toolbar.top}px` }}
      role="toolbar"
      aria-label="Text formatting"
      onClick={(event) => event.stopPropagation()}
    >
      {formatButtons.map(({ mark, label, icon }) => (
        <button
          key={mark}
          type="button"
          className={`btn btn-xs btn-square tooltip tooltip-bottom${toolbar.activeMarks.includes(mark) ? " btn-active" : ""}`}
          aria-label={label}
          data-tip={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            toggleMark(editor, mark);
          }}
        >
          {icon}
        </button>
      ))}
      <input
        type="color"
        className="donativus-vb-rich-text-color tooltip tooltip-bottom"
        aria-label={labels.formatTextColor}
        title={labels.formatTextColor}
        value={
          HEX_COLOR_PATTERN.test(toolbar.color) ? toolbar.color : "#000000"
        }
        onChange={(event) => {
          restoreSelection();
          setForegroundColor(editor, event.target.value);
        }}
      />
      <select
        className="select select-xs donativus-vb-rich-text-font"
        aria-label={labels.formatFontFamily}
        title={labels.formatFontFamily}
        value={toolbar.fontFamily}
        onChange={(event) => {
          restoreSelection();
          setFontFamily(editor, event.target.value || null);
        }}
      >
        <option value="">{labels.formatFontDefault}</option>
        {FONT_GROUPS.map((group) => (
          <optgroup key={group} label={labels[FONT_GROUP_LABEL_KEYS[group]]}>
            {FONT_CATALOGUE.filter((option) => option.group === group).map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                  style={{ fontFamily: option.value }}
                >
                  {option.label}
                </option>
              ),
            )}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-xs btn-square tooltip tooltip-bottom"
        aria-label={labels.formatClear}
        data-tip={labels.formatClear}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => clearFormatting(editor)}
      >
        <RemoveFormatting size={14} aria-hidden="true" />
      </button>
      {allowLinks ? (
        <>
          <button
            type="button"
            className={`btn btn-xs btn-square tooltip tooltip-bottom${toolbar.linkUrl !== null ? " btn-active" : ""}`}
            aria-label={labels.addLink}
            data-tip={labels.addLink}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setDestination(toolbar.linkUrl ?? "");
              setLinkInspectorOpen(true);
            }}
          >
            <Link2 size={14} aria-hidden="true" />
          </button>
          {toolbar.linkUrl !== null ? (
            <button
              type="button"
              className="btn btn-xs btn-square tooltip tooltip-bottom"
              aria-label={labels.removeLink}
              data-tip={labels.removeLink}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                toggleLink(editor, null);
                setLinkInspectorOpen(false);
              }}
            >
              <Unlink size={14} aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : null}
      {allowLinks && linkInspectorOpen ? (
        <div
          className="donativus-vb-link-inspector bg-base-100 border-base-300"
          role="dialog"
          aria-label={labels.addLink}
        >
          <div className="donativus-vb-link-inspector-form">
            <input
              type="text"
              className="input input-sm"
              aria-label={labels.fieldDestination}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (
                  next instanceof Element &&
                  next.closest(
                    ".donativus-vb-link-inspector, .donativus-vb-variable-insert-menu",
                  )
                ) {
                  return;
                }
                applyLink(destination);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                applyLink(destination);
              }}
            />
            <VariableTokenMenu
              variables={urlVariables}
              label={labels.addVariable}
              searchPlaceholder={labels.searchVariables}
              noMatchesLabel={labels.noVariableMatches}
              iconOnly
              wrapperClassName="donativus-vb-link-variable-picker"
              onSelect={(definition) => applyLink(definition.token)}
            />
          </div>
        </div>
      ) : null}
    </div>,
  );
}
