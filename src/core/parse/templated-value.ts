// Structural parsing of `TemplatedValue` (literal/variable segments). This
// only validates shape — resolving variable keys against a registry and
// enforcing allowed rendering contexts is section 7's job.

import type { TemplatedSegment, TemplatedValue } from "../../types/index.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import { isPlainObject, parseArray, parseString } from "../primitives.js";
import { err, issue, ok, type ParseResult } from "../result.js";

function parseTemplatedSegment(
  value: unknown,
  path: string,
): ParseResult<TemplatedSegment> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a template segment object at "${path}".`,
        { path },
      ),
    ]);
  }
  if (value.kind === "literal") {
    const text = parseString(value.value, `${path}.value`, {
      allowEmpty: true,
    });
    if (!text.ok) return text;
    return ok({ kind: "literal", value: text.value });
  }
  if (value.kind === "variable") {
    const variableKey = parseString(value.variableKey, `${path}.variableKey`, {
      allowEmpty: false,
      maxLength: 200,
    });
    const token = parseString(value.token, `${path}.token`, {
      allowEmpty: false,
      maxLength: 200,
    });
    if (!variableKey.ok) return variableKey;
    if (!token.ok) return token;
    return ok({
      kind: "variable",
      variableKey: variableKey.value,
      token: token.value,
    });
  }
  return err([
    issue(
      "value/invalid-segment-kind",
      `Segment at "${path}" must have kind "literal" or "variable".`,
      { path },
    ),
  ]);
}

export function parseTemplatedValue(
  value: unknown,
  path: string,
): ParseResult<TemplatedValue> {
  if (!isPlainObject(value)) {
    return err([
      issue("value/not-an-object", `Expected a templated value at "${path}".`, {
        path,
      }),
    ]);
  }
  const rawSegments = parseArray(value.segments, `${path}.segments`);
  if (!rawSegments.ok) return rawSegments;

  const segments: TemplatedSegment[] = [];
  const issues = [];
  let totalLength = 0;
  for (let index = 0; index < rawSegments.value.length; index += 1) {
    const result = parseTemplatedSegment(
      rawSegments.value[index],
      `${path}.segments[${index}]`,
    );
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    segments.push(result.value);
    totalLength +=
      result.value.kind === "literal"
        ? result.value.value.length
        : result.value.token.length;
  }
  if (issues.length > 0) return err(issues);
  if (totalLength > VISUAL_DOCUMENT_LIMITS.maxStringLength) {
    return err([
      issue(
        "value/templated-value-too-long",
        `Templated value at "${path}" exceeds the maximum combined length.`,
        { path },
      ),
    ]);
  }
  return ok({ segments });
}
