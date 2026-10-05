// Shared trigger+dropdown for picking a variable token (design.md decision
// #8). Used both by the rich-text adapter's insert control (text-context
// variables inside body copy) and by `TemplatedTextField` (url-context
// variables in CTA/image-link destinations) so a variable like the
// unsubscribe link is actually discoverable in the UI instead of requiring a
// consumer to already know and type its exact token.
//
// The dropdown is portaled to `document.body` and positioned from the
// trigger's bounding rect (matching the rich-text link inspector's own
// floating panel) rather than being an absolutely-positioned descendant of
// whatever scrollable rail happens to contain the trigger — nested inside a
// scroll container, the panel would get clipped by that ancestor's overflow
// and mouse-wheel scrolling over it would scroll the ancestor rail instead
// of the panel's own list. It deliberately skips daisyUI's `menu` class: that
// styling targets `li` children, not the plain buttons used here, so relying
// on it left every entry shrink-wrapped to content width and flex-wrapping
// into a multi-column grid instead of stacking one per row.

import type { VariableDefinition } from "../types/index.js";
import { Braces, Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface VariableTokenMenuProps {
  variables: readonly VariableDefinition[];
  label: string;
  onSelect: (definition: VariableDefinition) => void;
  /** Wrapper class for the trigger button only — the dropdown itself is portaled and positioned independently. */
  wrapperClassName?: string;
  /** Uses a compact icon trigger when the surrounding control already supplies the context. */
  iconOnly?: boolean;
  /** Placeholder for the search box, shown once there is more than one variable to filter. */
  searchPlaceholder?: string;
  /** Shown when a search query matches nothing. */
  noMatchesLabel?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  /** Room on the chosen side; the stylesheet caps it at the menu's own maximum. */
  maxHeight: number;
  placement: "above" | "below";
}

interface ViewportSize {
  width: number;
  height: number;
}

interface MenuSize {
  width: number;
  height: number;
}

const VIEWPORT_GUTTER = 8;
const MENU_GAP = 4;
const FALLBACK_MENU_SIZE: MenuSize = { width: 224, height: 256 };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Positions the portaled menu beside its trigger without letting it disappear
 * past a viewport edge. The initial fallback size is refined from the rendered
 * menu as soon as it mounts, so the result must be a fixed point: the menu's
 * rendered height fed back in yields the same position. A `maxHeight` present
 * only when the menu overflowed broke that — the capped height fit, the cap
 * came off, the menu overflowed again, and the loop crashed the page.
 */
export function resolveVariableMenuPosition(
  trigger: Pick<DOMRect, "top" | "bottom" | "right">,
  menu: MenuSize,
  viewport: ViewportSize,
): MenuPosition {
  const availableAbove = Math.max(0, trigger.top - MENU_GAP - VIEWPORT_GUTTER);
  const availableBelow = Math.max(
    0,
    viewport.height - trigger.bottom - MENU_GAP - VIEWPORT_GUTTER,
  );
  const desiredHeight = Math.min(
    menu.height,
    Math.max(0, viewport.height - VIEWPORT_GUTTER * 2),
  );
  const placement =
    availableBelow >= desiredHeight || availableBelow >= availableAbove
      ? "below"
      : "above";
  const availableHeight =
    placement === "above" ? availableAbove : availableBelow;
  const renderedHeight = Math.min(menu.height, availableHeight);
  const effectiveWidth = Math.min(
    menu.width,
    Math.max(0, viewport.width - VIEWPORT_GUTTER * 2),
  );
  const top = clamp(
    placement === "above"
      ? trigger.top - MENU_GAP - renderedHeight
      : trigger.bottom + MENU_GAP,
    VIEWPORT_GUTTER,
    Math.max(
      VIEWPORT_GUTTER,
      viewport.height - VIEWPORT_GUTTER - renderedHeight,
    ),
  );

  return {
    top,
    left: clamp(
      trigger.right - menu.width,
      VIEWPORT_GUTTER,
      Math.max(
        VIEWPORT_GUTTER,
        viewport.width - VIEWPORT_GUTTER - effectiveWidth,
      ),
    ),
    maxHeight: availableHeight,
    placement,
  };
}

function positionsMatch(
  current: MenuPosition | null,
  next: MenuPosition,
): boolean {
  return (
    current?.top === next.top &&
    current.left === next.left &&
    current.maxHeight === next.maxHeight &&
    current.placement === next.placement
  );
}

export function VariableTokenMenu({
  variables,
  label,
  onSelect,
  wrapperClassName = "donativus-vb-variable-insert-control",
  iconOnly = false,
  searchPlaceholder = "Search variables…",
  noMatchesLabel = "No variables match your search.",
}: VariableTokenMenuProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredVariables = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return variables;
    return variables.filter(
      (definition) =>
        definition.label.toLowerCase().includes(needle) ||
        definition.token.toLowerCase().includes(needle),
    );
  }, [variables, query]);

  useLayoutEffect(() => {
    if (!open || !position) return;
    const updatePosition = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuRect = menuRef.current?.getBoundingClientRect();
      const next = resolveVariableMenuPosition(
        rect,
        {
          width: menuRect?.width || FALLBACK_MENU_SIZE.width,
          height: menuRect?.height || FALLBACK_MENU_SIZE.height,
        },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPosition((current) => {
        return positionsMatch(current, next) ? current : next;
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updatePosition);
    if (observer) {
      if (triggerRef.current) observer.observe(triggerRef.current);
      if (menuRef.current) observer.observe(menuRef.current);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      observer?.disconnect();
    };
  }, [filteredVariables.length, open, position, query]);

  if (variables.length === 0) return null;

  return (
    <div
      className={wrapperClassName}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn-xs donativus-vb-variable-insert-trigger${iconOnly ? " btn-square tooltip tooltip-bottom" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={iconOnly ? label : undefined}
        data-tip={iconOnly ? label : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
            setPosition(null);
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setQuery("");
          setPosition(
            resolveVariableMenuPosition(rect, FALLBACK_MENU_SIZE, {
              width: window.innerWidth,
              height: window.innerHeight,
            }),
          );
          setOpen(true);
        }}
      >
        {iconOnly ? (
          <Braces size={14} aria-hidden="true" />
        ) : (
          <Plus size={13} aria-hidden="true" />
        )}
        {!iconOnly ? label.replace(/^\+\s*/, "") : null}
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="donativus-vb-variable-insert-menu bg-base-100"
              role="listbox"
              aria-label={label}
              data-placement={position.placement}
              style={
                {
                  top: position.top,
                  left: position.left,
                  "--donativus-vb-variable-menu-room": `${position.maxHeight}px`,
                } as React.CSSProperties
              }
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {variables.length > 1 ? (
                <input
                  type="text"
                  className="input input-xs donativus-vb-variable-insert-search"
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              ) : null}
              <div className="donativus-vb-variable-insert-list">
                {filteredVariables.length === 0 ? (
                  <p className="donativus-vb-variable-insert-empty">
                    {noMatchesLabel}
                  </p>
                ) : (
                  filteredVariables.map((definition) => (
                    <button
                      key={definition.key}
                      type="button"
                      role="option"
                      className="btn btn-ghost btn-sm justify-start"
                      onClick={() => {
                        onSelect(definition);
                        setOpen(false);
                      }}
                    >
                      <span>{definition.label}</span>
                      <code>{definition.token}</code>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
