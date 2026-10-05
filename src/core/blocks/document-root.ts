import type { DocumentRootProps } from "../../types/index.js";
import { isPlainObject } from "../primitives.js";
import { err, issue, ok, type ParseResult } from "../result.js";

/** Purely structural — no presentation fields to validate. */
export function parseDocumentRootProps(
  value: unknown,
  path: string,
): ParseResult<DocumentRootProps> {
  if (!isPlainObject(value)) {
    return err([
      issue(
        "value/not-an-object",
        `Expected document-root props at "${path}".`,
        { path },
      ),
    ]);
  }
  return ok({} as DocumentRootProps);
}
