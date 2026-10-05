import { HEX_COLOR_PATTERN, VISUAL_DOCUMENT_LIMITS } from "./limits.js";
import { err, issue, ok, type ParseResult } from "./result.js";

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseString(
  value: unknown,
  path: string,
  options: { maxLength?: number; allowEmpty?: boolean } = {},
): ParseResult<string> {
  if (typeof value !== "string") {
    return err([
      issue("value/not-a-string", `Expected a string at "${path}".`, { path }),
    ]);
  }
  const maxLength = options.maxLength ?? VISUAL_DOCUMENT_LIMITS.maxStringLength;
  if (value.length > maxLength) {
    return err([
      issue(
        "value/string-too-long",
        `Value at "${path}" exceeds the maximum length of ${maxLength}.`,
        { path },
      ),
    ]);
  }
  if (options.allowEmpty === false && value.length === 0) {
    return err([
      issue("value/string-empty", `Value at "${path}" must not be empty.`, {
        path,
      }),
    ]);
  }
  return ok(value);
}

export function parseFiniteNumber(
  value: unknown,
  path: string,
  options: { min?: number; max?: number } = {},
): ParseResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return err([
      issue("value/not-a-number", `Expected a finite number at "${path}".`, {
        path,
      }),
    ]);
  }
  if (options.min !== undefined && value < options.min) {
    return err([
      issue(
        "value/number-too-small",
        `Value at "${path}" must be >= ${options.min}.`,
        { path },
      ),
    ]);
  }
  if (options.max !== undefined && value > options.max) {
    return err([
      issue(
        "value/number-too-large",
        `Value at "${path}" must be <= ${options.max}.`,
        { path },
      ),
    ]);
  }
  return ok(value);
}

export function parsePositiveInteger(
  value: unknown,
  path: string,
): ParseResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return err([
      issue(
        "value/not-a-positive-integer",
        `Expected a positive integer at "${path}".`,
        { path },
      ),
    ]);
  }
  return ok(value);
}

export function parseBoolean(
  value: unknown,
  path: string,
): ParseResult<boolean> {
  if (typeof value !== "boolean") {
    return err([
      issue("value/not-a-boolean", `Expected a boolean at "${path}".`, {
        path,
      }),
    ]);
  }
  return ok(value);
}

export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): ParseResult<T> {
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  ) {
    return err([
      issue(
        "value/invalid-enum",
        `Value at "${path}" must be one of: ${allowed.join(", ")}.`,
        { path },
      ),
    ]);
  }
  return ok(value as T);
}

export function parseHexColor(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
    return err([
      issue(
        "value/invalid-color",
        `Value at "${path}" must be a "#RRGGBB" or "#RRGGBBAA" color.`,
        { path },
      ),
    ]);
  }
  return ok(value);
}

export function parseNullableHexColor(
  value: unknown,
  path: string,
): ParseResult<string | null> {
  if (value === null) return ok(null);
  return parseHexColor(value, path);
}

export function parseArray(
  value: unknown,
  path: string,
): ParseResult<unknown[]> {
  if (!Array.isArray(value)) {
    return err([
      issue("value/not-an-array", `Expected an array at "${path}".`, { path }),
    ]);
  }
  return ok(value);
}
