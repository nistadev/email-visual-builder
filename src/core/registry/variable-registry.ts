import { err, issue, ok, type ParseResult } from "../result.js";
import {
  DEFAULT_VARIABLE_SYNTAX,
  type VariableSyntaxDefinition,
} from "../variables/token-syntax.js";
import { validateVariableDefinitionShape } from "../variables/validate-definition.js";
import { buildRegistry, type BuildRegistryOptions } from "./build-registry.js";
import type { VariableRegistry, VariableRegistryDefinition } from "./types.js";

export interface CreateVariableRegistryOptions extends BuildRegistryOptions<string> {
  /** Overrides the default percent-delimited variable-like syntax (task 7.3). */
  syntax?: VariableSyntaxDefinition;
}

/**
 * The package never hardcodes product-specific variables (design.md
 * decision #8) — there are no "built-in" variables, only consumer-supplied
 * ones, so this always builds from a single flat list. Each definition's
 * shape is validated (key/token/label/sample/allowed contexts — task 7.1),
 * and tokens must be unique so variable-like text can be resolved
 * unambiguously (task 7.3).
 */
export function createVariableRegistry(
  definitions: readonly VariableRegistryDefinition[],
  options: CreateVariableRegistryOptions = {},
): ParseResult<VariableRegistry> {
  const shapeIssues = [];
  const tokenToKey = new Map<string, string>();
  for (const [index, definition] of definitions.entries()) {
    const shapeResult = validateVariableDefinitionShape(
      definition,
      `variables[${index}]`,
    );
    if (!shapeResult.ok) {
      shapeIssues.push(...shapeResult.issues);
      continue;
    }
    const existingKey = tokenToKey.get(definition.token);
    if (existingKey !== undefined && existingKey !== definition.key) {
      shapeIssues.push(
        issue(
          "registry/duplicate-variable-token",
          `Variable token "${definition.token}" is declared by both "${existingKey}" and "${definition.key}".`,
        ),
      );
      continue;
    }
    tokenToKey.set(definition.token, definition.key);
  }
  if (shapeIssues.length > 0) return err(shapeIssues);

  const registryResult = buildRegistry(
    definitions,
    [],
    (definition) => definition.key,
    options,
  );
  if (!registryResult.ok) return registryResult;

  return ok({
    ...registryResult.value,
    syntax: options.syntax ?? DEFAULT_VARIABLE_SYNTAX,
  });
}
