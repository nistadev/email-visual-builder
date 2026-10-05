// Variable definitions are injected by the consumer (e.g. a host app supplies
// the marketing `%recipient.<key>%` registry); the package never hardcodes a
// specific product's variables. See design.md decision #8.

/**
 * Where a variable is allowed to render. `url`/`image-url` must be granted
 * explicitly — a variable typed only for `text` cannot be used inside a CTA
 * destination, image link, or favicon URL.
 */
export type VariableRenderContext =
  "text" | "url" | "image-url" | "email-system-link";

export interface VariableDefinition {
  key: string;
  /** Exact exported token, e.g. `%recipient.firstName%`. */
  token: string;
  label: string;
  sampleValue?: string;
  allowedContexts: VariableRenderContext[];
}

export type TemplatedSegment =
  | { kind: "literal"; value: string }
  | { kind: "variable"; variableKey: string; token: string };

/**
 * A structured literal/variable template used anywhere a single string of
 * user content may embed variables: heading text, CTA labels, and CTA/
 * image-link/favicon destinations. Literal segments are escaped for their
 * output context by the renderer; variable segments preserve the exact
 * configured token.
 */
export interface TemplatedValue {
  segments: TemplatedSegment[];
}
