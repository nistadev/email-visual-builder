import type { VisualDocumentValidationIssue } from "../types/index.js";

export interface ParseSuccess<T> {
  ok: true;
  value: T;
}

export interface ParseFailure {
  ok: false;
  issues: VisualDocumentValidationIssue[];
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function ok<T>(value: T): ParseSuccess<T> {
  return { ok: true, value };
}

export function err(issues: VisualDocumentValidationIssue[]): ParseFailure {
  return { ok: false, issues };
}

export interface IssueLocation {
  nodeId?: string;
  path?: string;
}

export function issue(
  code: string,
  message: string,
  location: IssueLocation = {},
): VisualDocumentValidationIssue {
  return { code, message, ...location };
}

/**
 * Collects issues across independently-parsed sibling fields instead of
 * short-circuiting on the first error, so a single failed parse reports
 * every problem at once (per design.md decision #10 — errors identify
 * node/path).
 */
export class FieldCollector {
  private readonly issues: VisualDocumentValidationIssue[] = [];

  field<T>(result: ParseResult<T>, fallback: T): T {
    if (!result.ok) {
      this.issues.push(...result.issues);
      return fallback;
    }
    return result.value;
  }

  push(...issues: VisualDocumentValidationIssue[]): void {
    this.issues.push(...issues);
  }

  finish<T>(value: T): ParseResult<T> {
    return this.issues.length > 0 ? err([...this.issues]) : ok(value);
  }
}
