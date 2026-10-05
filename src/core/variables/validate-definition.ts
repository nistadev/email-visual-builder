// Instance-scoped variable registry validation (design.md decision #8,
// task 7.1). `VariableDefinition` is consumer-injected, untrusted runtime
// data — a TypeScript interface alone does not stop a malformed definition
// (empty token, no allowed contexts, ...) from reaching the registry.

import type { VariableRegistryDefinition } from "../registry/types.js";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  isPlainObject,
  parseArray,
  parseEnum,
  parseString,
} from "../primitives.js";
import { err, issue, ok, type ParseResult } from "../result.js";

const VARIABLE_RENDER_CONTEXTS = [
  "text",
  "url",
  "image-url",
  "email-system-link",
] as const;

export function validateVariableDefinitionShape(
  value: VariableRegistryDefinition,
  path: string,
): ParseResult<VariableRegistryDefinition> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected a variable definition at "${path}".`,
        { path },
      ),
    ]);
  }

  const issues = [];
  const key = parseString(value.key, `${path}.key`, {
    allowEmpty: false,
    maxLength: 200,
  });
  if (!key.ok) issues.push(...key.issues);
  const token = parseString(value.token, `${path}.token`, {
    allowEmpty: false,
    maxLength: 200,
  });
  if (!token.ok) issues.push(...token.issues);
  const label = parseString(value.label, `${path}.label`, {
    allowEmpty: false,
    maxLength: 200,
  });
  if (!label.ok) issues.push(...label.issues);

  if (value.sampleValue !== undefined) {
    const sample = parseString(value.sampleValue, `${path}.sampleValue`, {
      allowEmpty: true,
      maxLength: VISUAL_DOCUMENT_LIMITS.maxStringLength,
    });
    if (!sample.ok) issues.push(...sample.issues);
  }

  const contexts = parseArray(value.allowedContexts, `${path}.allowedContexts`);
  if (!contexts.ok) {
    issues.push(...contexts.issues);
  } else if (contexts.value.length === 0) {
    issues.push(
      issue(
        "value/empty-allowed-contexts",
        `Variable definition at "${path}" must declare at least one allowed rendering context.`,
        { path },
      ),
    );
  } else {
    for (let index = 0; index < contexts.value.length; index += 1) {
      const contextResult = parseEnum(
        contexts.value[index],
        VARIABLE_RENDER_CONTEXTS,
        `${path}.allowedContexts[${index}]`,
      );
      if (!contextResult.ok) issues.push(...contextResult.issues);
    }
  }

  if (issues.length > 0) return err(issues);
  return ok(value);
}
