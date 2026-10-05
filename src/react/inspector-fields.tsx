// Controlled inspector field primitives (task 12.8). Every commit goes
// through a typed `update-node-props` command; the command handler's parser
// is the validator — a rejected value reverts (the controlled input re-reads
// document state) and the command issues surface under the field. Chrome is
// daisyUI semantic classes only; authored values never style chrome.

import type {
  ShadowValue,
  SocialLinkItem,
  SpacingValue,
  TemplatedValue,
  TypographyValue,
  WidthValue,
} from "../types/index.js";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Info,
  Link2,
  Plus,
  Trash2,
  Unlink2,
} from "lucide-react";
import { SOCIAL_PLATFORMS } from "../core/blocks/social-icon-assets.generated.js";
import { FONT_CATALOGUE } from "../core/fonts.js";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { VisualDocumentValidationIssue } from "../types/index.js";
import {
  editableStringToTemplatedValue,
  templatedValueToEditableString,
} from "./rich-text/templated-value-editing.js";
import { formatIssueMessage } from "./issue-messages.js";
import { useBuilderActions, useBuilderMeta } from "./provider.js";
import { VariableTokenMenu } from "./variable-token-menu.js";

function handleShiftStep(
  event: ReactKeyboardEvent<HTMLInputElement>,
  value: number,
  options: { min?: number; max?: number; step?: number },
  apply: (value: number) => void,
): void {
  if (!event.shiftKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown"))
    return;
  event.preventDefault();
  const direction = event.key === "ArrowUp" ? 1 : -1;
  const delta = (options.step ?? 1) * 10 * direction;
  const nextValue = Math.min(
    options.max ?? Number.POSITIVE_INFINITY,
    Math.max(options.min ?? Number.NEGATIVE_INFINITY, value + delta),
  );
  apply(nextValue);
}

export interface FieldCommit {
  /** Merges a partial props patch into the selected node's props and dispatches it. Returns command issues (empty on success). */
  (patch: Record<string, unknown>): VisualDocumentValidationIssue[];
}

/** Builds the shared commit function for a node: merge patch over current props, dispatch, report issues. */
export function usePropsCommit(nodeId: string): FieldCommit {
  const actions = useBuilderActions();
  const { controller } = useBuilderMeta();
  return (patch) => {
    const node = controller.getState().document.nodes[nodeId];
    if (!node) return [];
    const result = actions.dispatch({
      type: "update-node-props",
      nodeId,
      props: { ...(node.props as Record<string, unknown>), ...patch },
    });
    return result.ok ? [] : result.issues;
  };
}

interface FieldShellProps {
  label: string;
  issues: VisualDocumentValidationIssue[];
  htmlFor: string;
  children: ReactNode;
  helpText?: string;
}

function FieldShell({
  label,
  issues,
  htmlFor,
  children,
  helpText,
}: FieldShellProps): React.JSX.Element {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="donativus-vb-field">
      <label className="label" htmlFor={htmlFor}>
        <span>{label}</span>
        {helpText ? (
          <span
            className="tooltip tooltip-bottom tooltip-end donativus-vb-field-help"
            data-tip={helpText}
            aria-label={helpText}
            tabIndex={0}
          >
            <Info size={14} strokeWidth={1.8} aria-hidden="true" />
          </span>
        ) : null}
      </label>
      {children}
      {issues.length > 0 && (
        <p
          className="donativus-vb-field-error text-error"
          id={errorId}
          role="alert"
        >
          {issues[0] ? formatIssueMessage(issues[0], label) : null}
        </p>
      )}
    </div>
  );
}

interface CommonFieldProps {
  label: string;
  commit: FieldCommit;
}

/** Hook bundling per-field issue state + the blur behavior that ends history coalescing runs. */
function useFieldState(): {
  issues: VisualDocumentValidationIssue[];
  setIssues: (issues: VisualDocumentValidationIssue[]) => void;
  onBlur: () => void;
} {
  const [issues, setIssues] = useState<VisualDocumentValidationIssue[]>([]);
  const actions = useBuilderActions();
  return { issues, setIssues, onBlur: () => actions.breakHistoryCoalescing() };
}

export function TextField({
  label,
  commit,
  value,
  propKey,
  helpText,
}: CommonFieldProps & {
  value: string;
  propKey: string;
  helpText?: string;
}): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  return (
    <FieldShell label={label} issues={issues} htmlFor={id} helpText={helpText}>
      <input
        id={id}
        type="text"
        className="input input-sm w-full"
        value={value}
        aria-invalid={issues.length > 0 || undefined}
        onChange={(event) =>
          setIssues(commit({ [propKey]: event.target.value }))
        }
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

export function NumberField({
  label,
  commit,
  value,
  propKey,
  transform = (n) => n,
  min,
  max,
  step = 1,
}: CommonFieldProps & {
  value: number;
  propKey: string;
  /** Maps the raw number into the committed prop value (e.g. wrap into a width object). */
  transform?: (value: number) => unknown;
  min?: number;
  max?: number;
  step?: number;
}): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <input
        id={id}
        type="number"
        className="input input-sm w-full"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        aria-invalid={issues.length > 0 || undefined}
        onKeyDown={(event) =>
          handleShiftStep(event, value, { min, max, step }, (nextValue) =>
            setIssues(commit({ [propKey]: transform(nextValue) })),
          )
        }
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isNaN(parsed)) return;
          setIssues(commit({ [propKey]: transform(parsed) }));
        }}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

export function ColorField({
  label,
  commit,
  value,
  propKey,
  transform = (color) => color,
  disabled = false,
}: CommonFieldProps & {
  value: string | null;
  propKey: string;
  transform?: (color: string) => unknown;
  /** Keeps the field's position stable in a form whose other fields depend on this one, instead of mounting/unmounting it (which reflows every field below). */
  disabled?: boolean;
}): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <input
        id={id}
        type="color"
        className="donativus-vb-color-input"
        value={value ?? "#000000"}
        disabled={disabled}
        aria-invalid={issues.length > 0 || undefined}
        onChange={(event) =>
          setIssues(commit({ [propKey]: transform(event.target.value) }))
        }
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  commit,
  value,
  propKey,
  options,
  transform = (option) => option,
  disabled = false,
}: CommonFieldProps & {
  value: string;
  propKey: string;
  options: readonly { value: string; label: string }[];
  transform?: (option: string) => unknown;
  /** Keeps the field's position stable in a form whose other fields depend on this one, instead of mounting/unmounting it (which reflows every field below). */
  disabled?: boolean;
}): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <select
        id={id}
        className="select select-sm w-full"
        value={value}
        disabled={disabled}
        aria-invalid={issues.length > 0 || undefined}
        onChange={(event) =>
          setIssues(commit({ [propKey]: transform(event.target.value) }))
        }
        onBlur={onBlur}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function AlignField({
  commit,
  value,
  propKey = "align",
}: {
  commit: FieldCommit;
  value: string;
  propKey?: string;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const { issues, setIssues, onBlur } = useFieldState();
  const options = [
    { value: "left", label: labels.alignLeft, Icon: AlignLeft },
    { value: "center", label: labels.alignCenter, Icon: AlignCenter },
    { value: "right", label: labels.alignRight, Icon: AlignRight },
  ] as const;
  return (
    <div className="donativus-vb-field">
      <span className="label">{labels.fieldAlign}</span>
      <div
        className="join donativus-vb-segmented-control"
        role="group"
        aria-label={labels.fieldAlign}
      >
        {options.map(({ value: option, label, Icon }) => (
          <button
            key={option}
            type="button"
            className={`btn btn-sm join-item${value === option ? " btn-active" : ""}`}
            aria-label={label}
            aria-pressed={value === option}
            title={label}
            onClick={() => setIssues(commit({ [propKey]: option }))}
            onBlur={onBlur}
          >
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ))}
      </div>
      {issues.length > 0 && (
        <p className="donativus-vb-field-error text-error" role="alert">
          {issues[0] ? formatIssueMessage(issues[0], labels.fieldAlign) : null}
        </p>
      )}
    </div>
  );
}

export function WidthField({
  label,
  commit,
  value,
  propKey,
  allowAuto = false,
}: CommonFieldProps & {
  value: WidthValue | { unit: "auto" };
  propKey: string;
  allowAuto?: boolean;
}): React.JSX.Element {
  const id = useId();
  const { labels } = useBuilderMeta();
  const { issues, setIssues, onBlur } = useFieldState();
  const unit = value.unit;
  const numericValue = unit === "auto" ? 100 : value.value;

  const setUnit = (nextUnit: "px" | "percent" | "auto"): void => {
    const nextValue =
      nextUnit === "auto"
        ? { unit: "auto" as const }
        : {
            unit: nextUnit,
            value:
              nextUnit === "percent"
                ? Math.min(numericValue, 100)
                : numericValue,
          };
    setIssues(commit({ [propKey]: nextValue }));
  };

  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <div className="join donativus-vb-unit-field">
        <input
          id={id}
          type="number"
          className="input input-sm join-item"
          value={numericValue}
          min={0}
          max={unit === "percent" ? 100 : undefined}
          disabled={unit === "auto"}
          aria-invalid={issues.length > 0 || undefined}
          onKeyDown={(event) => {
            if (unit === "auto") return;
            handleShiftStep(
              event,
              numericValue,
              { min: 0, max: unit === "percent" ? 100 : undefined },
              (nextValue) =>
                setIssues(commit({ [propKey]: { unit, value: nextValue } })),
            );
          }}
          onChange={(event) => {
            if (unit === "auto") return;
            const parsed = Number(event.target.value);
            if (Number.isNaN(parsed)) return;
            setIssues(commit({ [propKey]: { unit, value: parsed } }));
          }}
          onBlur={onBlur}
        />
        <select
          className="select select-sm join-item donativus-vb-unit-select"
          value={unit}
          aria-label={labels.fieldWidthUnit}
          onChange={(event) =>
            setUnit(event.target.value as "px" | "percent" | "auto")
          }
          onBlur={onBlur}
        >
          {allowAuto ? (
            <option value="auto">{labels.fieldWidthAuto}</option>
          ) : null}
          <option value="percent">{labels.fieldWidthPercent}</option>
          <option value="px">{labels.fieldWidthPixels}</option>
        </select>
      </div>
    </FieldShell>
  );
}

export function ToggleField({
  label,
  commit,
  value,
  propKey,
}: CommonFieldProps & { value: boolean; propKey: string }): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="toggle toggle-sm"
        checked={value}
        onChange={(event) =>
          setIssues(commit({ [propKey]: event.target.checked }))
        }
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

function newSocialItemId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `item-${Math.random().toString(36).slice(2)}`;
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** Add/remove/reorder control for the `social` block's `items` array — a plain array-valued prop (design.md "Item model"), so it commits the whole array on every change rather than routing through a per-field `propKey`. */
export function SocialItemsField({
  commit,
  items,
}: {
  commit: FieldCommit;
  items: readonly SocialLinkItem[];
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const { issues, setIssues, onBlur } = useFieldState();

  const commitItems = (next: SocialLinkItem[]) =>
    setIssues(commit({ items: next }));

  return (
    <div className="donativus-vb-field">
      <span className="label">
        <span>{labels.groupContent}</span>
      </span>
      <ul
        className="donativus-vb-social-items"
        aria-label={labels.groupContent}
      >
        {items.map((item, index) => (
          <li key={item.id} className="donativus-vb-social-item">
            <select
              className="select select-sm"
              aria-label={labels.fieldSocialPlatform}
              value={item.platform}
              onChange={(event) =>
                commitItems(
                  items.map((existing, existingIndex) =>
                    existingIndex === index
                      ? {
                          ...existing,
                          platform: event.target
                            .value as SocialLinkItem["platform"],
                        }
                      : existing,
                  ),
                )
              }
            >
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {labels.socialPlatformNames[platform] ?? platform}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="input input-sm w-full"
              aria-label={labels.fieldSocialUrl}
              placeholder="https://"
              value={item.url}
              onChange={(event) =>
                commitItems(
                  items.map((existing, existingIndex) =>
                    existingIndex === index
                      ? { ...existing, url: event.target.value }
                      : existing,
                  ),
                )
              }
              onBlur={onBlur}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              aria-label={labels.moveUp}
              disabled={index === 0}
              onClick={() => commitItems(moveItem(items, index, index - 1))}
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              aria-label={labels.moveDown}
              disabled={index === items.length - 1}
              onClick={() => commitItems(moveItem(items, index, index + 1))}
            >
              <ArrowDown size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              aria-label={labels.removeSocialItem(
                labels.socialPlatformNames[item.platform] ?? item.platform,
              )}
              onClick={() =>
                commitItems(
                  items.filter((_, existingIndex) => existingIndex !== index),
                )
              }
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-sm btn-block justify-start"
        onClick={() =>
          commitItems([
            ...items,
            { id: newSocialItemId(), platform: "website", url: "" },
          ])
        }
      >
        <Plus size={15} aria-hidden="true" />
        {labels.addSocialItem}
      </button>
      {issues.length > 0 && (
        <p className="donativus-vb-field-error text-error" role="alert">
          {issues[0]
            ? formatIssueMessage(issues[0], labels.groupContent)
            : null}
        </p>
      )}
    </div>
  );
}

/** Templated URL/value fields: tokens typed verbatim are resolved against the registry and unresolved tokens remain literal for validation. */
export function TemplatedTextField({
  label,
  commit,
  value,
  propKey,
  nullable = false,
}: CommonFieldProps & {
  value: TemplatedValue | null;
  propKey: string;
  nullable?: boolean;
}): React.JSX.Element {
  const id = useId();
  const { issues, setIssues, onBlur } = useFieldState();
  const { registries, labels } = useBuilderMeta();
  const inputRef = useRef<HTMLInputElement>(null);
  const text = value ? templatedValueToEditableString(value) : "";
  const urlVariables = registries.variables
    .list()
    .filter((definition) => definition.allowedContexts.includes("url"));

  const applyText = (nextText: string) => {
    const nextValue =
      nullable && nextText === ""
        ? null
        : editableStringToTemplatedValue(nextText, registries.variables);
    setIssues(commit({ [propKey]: nextValue }));
  };

  return (
    <FieldShell label={label} issues={issues} htmlFor={id}>
      <div className="donativus-vb-templated-text-field">
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="input input-sm w-full"
          value={text}
          aria-invalid={issues.length > 0 || undefined}
          onChange={(event) => applyText(event.target.value)}
          onBlur={onBlur}
        />
        {/* Otherwise a url-context variable (e.g. the unsubscribe link) can only be inserted by typing its exact token from memory. */}
        <VariableTokenMenu
          variables={urlVariables}
          label={labels.addVariable}
          searchPlaceholder={labels.searchVariables}
          noMatchesLabel={labels.noVariableMatches}
          wrapperClassName="donativus-vb-templated-field-variables"
          onSelect={(definition) => {
            const el = inputRef.current;
            const start = el?.selectionStart ?? text.length;
            const end = el?.selectionEnd ?? text.length;
            const nextText =
              text.slice(0, start) + definition.token + text.slice(end);
            applyText(nextText);
            requestAnimationFrame(() => {
              el?.focus();
              const caret = start + definition.token.length;
              el?.setSelectionRange(caret, caret);
            });
          }}
        />
      </div>
    </FieldShell>
  );
}

export function SpacingFields({
  commit,
  value,
  propKey = "spacing",
  label,
  linkLabel,
  unlinkLabel,
}: {
  commit: FieldCommit;
  value: SpacingValue;
  propKey?: string;
  label?: string;
  linkLabel?: string;
  unlinkLabel?: string;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const [linked, setLinked] = useState(
    () =>
      value.topPx === value.rightPx &&
      value.topPx === value.bottomPx &&
      value.topPx === value.leftPx,
  );
  const sides = [
    { key: "topPx", label: labels.fieldSpacingTop },
    { key: "rightPx", label: labels.fieldSpacingRight },
    { key: "bottomPx", label: labels.fieldSpacingBottom },
    { key: "leftPx", label: labels.fieldSpacingLeft },
  ] as const;
  return (
    <div className="donativus-vb-spacing-fields">
      <div className="donativus-vb-spacing-header">
        <span className="label">{label ?? labels.fieldPadding}</span>
        <button
          type="button"
          className={`btn btn-xs btn-square${linked ? " btn-active" : ""}`}
          aria-label={
            linked
              ? (unlinkLabel ?? labels.unlinkSpacing)
              : (linkLabel ?? labels.linkSpacing)
          }
          aria-pressed={linked}
          title={
            linked
              ? (unlinkLabel ?? labels.unlinkSpacing)
              : (linkLabel ?? labels.linkSpacing)
          }
          onClick={() => {
            const nextLinked = !linked;
            setLinked(nextLinked);
            if (nextLinked) {
              const px = value.topPx;
              commit({
                [propKey]: {
                  topPx: px,
                  rightPx: px,
                  bottomPx: px,
                  leftPx: px,
                },
              });
            }
          }}
        >
          {linked ? (
            <Link2 size={14} aria-hidden="true" />
          ) : (
            <Unlink2 size={14} aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="donativus-vb-spacing-grid">
        {sides.map((side) => (
          <NumberField
            key={side.key}
            label={side.label}
            commit={commit}
            value={value[side.key]}
            propKey={propKey}
            min={0}
            transform={(px) =>
              linked
                ? {
                    topPx: px,
                    rightPx: px,
                    bottomPx: px,
                    leftPx: px,
                  }
                : { ...value, [side.key]: px }
            }
          />
        ))}
      </div>
    </div>
  );
}

export function MarginFields({
  commit,
  value,
}: {
  commit: FieldCommit;
  value: SpacingValue;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  return (
    <SpacingFields
      commit={commit}
      value={value}
      propKey="margin"
      label={labels.fieldMargin}
      linkLabel={labels.linkMargin}
      unlinkLabel={labels.unlinkMargin}
    />
  );
}

const DEFAULT_ENABLED_SHADOW: ShadowValue = {
  offsetXPx: 0,
  offsetYPx: 8,
  blurPx: 30,
  spreadPx: -15,
  color: "#b3b3b3",
};

export function ShadowFields({
  commit,
  value,
}: {
  commit: FieldCommit;
  value: ShadowValue | null;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const shadowCommit: FieldCommit = (patch) =>
    value ? commit({ shadow: { ...value, ...patch } }) : [];

  return (
    <div className="donativus-vb-shadow-fields">
      <ToggleField
        label={labels.fieldShadow}
        commit={(patch) =>
          commit({
            shadow: patch.shadow ? DEFAULT_ENABLED_SHADOW : null,
          })
        }
        value={value !== null}
        propKey="shadow"
      />
      {value ? (
        <div className="donativus-vb-shadow-grid">
          <NumberField
            label={labels.fieldShadowOffsetX}
            commit={shadowCommit}
            value={value.offsetXPx}
            propKey="offsetXPx"
            min={-200}
            max={200}
          />
          <NumberField
            label={labels.fieldShadowOffsetY}
            commit={shadowCommit}
            value={value.offsetYPx}
            propKey="offsetYPx"
            min={-200}
            max={200}
          />
          <NumberField
            label={labels.fieldShadowBlur}
            commit={shadowCommit}
            value={value.blurPx}
            propKey="blurPx"
            min={0}
            max={200}
          />
          <NumberField
            label={labels.fieldShadowSpread}
            commit={shadowCommit}
            value={value.spreadPx}
            propKey="spreadPx"
            min={-200}
            max={200}
          />
          <ColorField
            label={labels.fieldShadowColor}
            commit={shadowCommit}
            value={value.color}
            propKey="color"
          />
        </div>
      ) : null}
    </div>
  );
}

export function TypographyFields({
  commit,
  value,
  propKey = "typography",
}: {
  commit: FieldCommit;
  value: TypographyValue;
  propKey?: string;
}): React.JSX.Element {
  const { labels } = useBuilderMeta();
  const { issues, setIssues, onBlur } = useFieldState();
  const fontOptions = FONT_CATALOGUE.some(
    (option) => option.value === value.fontFamily,
  )
    ? FONT_CATALOGUE
    : [{ value: value.fontFamily, label: value.fontFamily }, ...FONT_CATALOGUE];
  const weightOptions: readonly {
    value: TypographyValue["fontWeight"];
    label: string;
  }[] = [
    { value: "thin", label: labels.fontWeightThin },
    { value: "normal", label: labels.fontWeightNormal },
    { value: "semibold", label: labels.fontWeightSemibold },
    { value: "bold", label: labels.fontWeightBold },
  ];
  const patch = (
    partial: Partial<TypographyValue>,
  ): Record<string, unknown> => ({
    [propKey]: { ...value, ...partial },
  });
  return (
    <div className="donativus-vb-typography-fields">
      <div className="donativus-vb-typography-family-row">
        <SelectField
          label={labels.fieldFontFamily}
          commit={(p) => commit(patch({ fontFamily: p.fontFamily as string }))}
          value={value.fontFamily}
          propKey="fontFamily"
          options={fontOptions}
        />
        <ColorField
          label={labels.fieldTextColor}
          commit={(p) => commit(patch({ color: p.color as string }))}
          value={value.color}
          propKey="color"
        />
      </div>
      <NumberField
        label={labels.fieldFontSize}
        commit={(p) => commit(patch({ fontSizePx: p.fontSizePx as number }))}
        value={value.fontSizePx}
        propKey="fontSizePx"
      />
      <NumberField
        label={labels.fieldLetterSpacing}
        commit={(p) =>
          commit(patch({ letterSpacingPx: p.letterSpacingPx as number }))
        }
        value={value.letterSpacingPx}
        propKey="letterSpacingPx"
      />
      <div className="donativus-vb-field">
        <span className="label">{labels.fieldFontWeight}</span>
        <div
          className="join donativus-vb-font-weight-control"
          role="group"
          aria-label={labels.fieldFontWeight}
        >
          {weightOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-xs join-item${value.fontWeight === option.value ? " btn-active" : ""}`}
              aria-pressed={value.fontWeight === option.value}
              onClick={() =>
                setIssues(commit(patch({ fontWeight: option.value })))
              }
              onBlur={onBlur}
            >
              {option.label}
            </button>
          ))}
        </div>
        {issues.length > 0 && (
          <p className="donativus-vb-field-error text-error" role="alert">
            {issues[0]
              ? formatIssueMessage(issues[0], labels.fieldFontWeight)
              : null}
          </p>
        )}
      </div>
    </div>
  );
}
