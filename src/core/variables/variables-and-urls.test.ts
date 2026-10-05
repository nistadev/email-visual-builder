import assert from "node:assert/strict";
import test from "node:test";
import type {
  CtaNode,
  RichTextNode,
  RichTextValue,
  SocialLinkItem,
  SocialNode,
  TemplatedValue,
  VariableDefinition,
  VisualBuilderNodeRecord,
  VisualDocument,
} from "../../types/index.js";
import { createVariableRegistry } from "../registry/variable-registry.js";
import type { VariableRegistry } from "../registry/types.js";
import { createStarterDocument } from "../starter-document.js";
import { validateSafeUrl } from "../url.js";
import { checkLiteralTextForUnresolvedVariables } from "./unresolved-text.js";
import {
  collectLinkQualityWarnings,
  collectUnsubscribeLinkWarning,
} from "./document-quality-checks.js";
import { resolveVariableReference } from "./resolve.js";
import {
  findVariableLikeMatches,
  DEFAULT_VARIABLE_SYNTAX,
} from "./token-syntax.js";
import { validateDocumentVariablesAndUrls } from "./validate-document.js";
import { validateRichTextValue } from "./validate-rich-text.js";
import { validateTemplatedValue } from "./validate-templated-value.js";

const RECIPIENT_FIRST_NAME: VariableDefinition = {
  key: "recipient.firstName",
  token: "%recipient.firstName%",
  label: "Recipient first name",
  sampleValue: "Alex",
  allowedContexts: ["text"],
};

const DONATE_URL: VariableDefinition = {
  key: "donate.url",
  token: "%donate.url%",
  label: "Donate link",
  allowedContexts: ["url"],
};

const UNSUBSCRIBE_URL: VariableDefinition = {
  key: "unsubscribe_url",
  token: "%unsubscribe_url%",
  label: "Unsubscribe link",
  allowedContexts: ["url", "email-system-link"],
};

function requireRegistry(definitions: VariableDefinition[]): VariableRegistry {
  const result = createVariableRegistry(definitions);
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : JSON.stringify(result.issues),
  );
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

const REGISTRY = requireRegistry([
  RECIPIENT_FIRST_NAME,
  DONATE_URL,
  UNSUBSCRIBE_URL,
]);

function literal(value: string): TemplatedValue {
  return { segments: [{ kind: "literal", value }] };
}

function variableSegment(definition: VariableDefinition): TemplatedValue {
  return {
    segments: [
      {
        kind: "variable",
        variableKey: definition.key,
        token: definition.token,
      },
    ],
  };
}

test.describe("createVariableRegistry — shape validation (7.1)", () => {
  test("accepts well-formed definitions", () => {
    const result = createVariableRegistry([RECIPIENT_FIRST_NAME, DONATE_URL]);
    assert.equal(result.ok, true);
  });

  test("rejects a definition missing key/token/label", () => {
    const result = createVariableRegistry([
      {
        key: "",
        token: "",
        label: "",
        allowedContexts: ["text"],
      } as VariableDefinition,
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "value/string-empty"),
    );
  });

  test("rejects a definition with no allowed contexts", () => {
    const result = createVariableRegistry([
      { ...RECIPIENT_FIRST_NAME, allowedContexts: [] },
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "value/empty-allowed-contexts",
      ),
    );
  });

  test("rejects a definition with an invalid context value", () => {
    const result = createVariableRegistry([
      {
        ...RECIPIENT_FIRST_NAME,
        allowedContexts: ["not-a-real-context" as never],
      },
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some((issue) => issue.code === "value/invalid-enum"),
    );
  });

  test("rejects two different keys declaring the same exact token", () => {
    const result = createVariableRegistry([
      RECIPIENT_FIRST_NAME,
      { ...DONATE_URL, token: RECIPIENT_FIRST_NAME.token },
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "registry/duplicate-variable-token",
      ),
    );
  });

  test("builds with the default percent-style syntax unless overridden", () => {
    const registry = requireRegistry([RECIPIENT_FIRST_NAME]);
    assert.equal(registry.syntax, DEFAULT_VARIABLE_SYNTAX);
    const custom = createVariableRegistry([RECIPIENT_FIRST_NAME], {
      syntax: { pattern: /\{\{\w+\}\}/g },
    });
    assert.equal(custom.ok, true);
    if (!custom.ok) return;
    assert.notEqual(custom.value.syntax, DEFAULT_VARIABLE_SYNTAX);
  });
});

test.describe("resolveVariableReference (7.2)", () => {
  test("resolves a valid key/token pair, preserving the exact token", () => {
    const resolution = resolveVariableReference(
      RECIPIENT_FIRST_NAME.key,
      RECIPIENT_FIRST_NAME.token,
      REGISTRY,
      "path",
    );
    assert.equal(resolution.ok, true);
    if (!resolution.ok) return;
    assert.equal(resolution.definition.token, RECIPIENT_FIRST_NAME.token);
    assert.equal(resolution.definition.sampleValue, "Alex");
  });

  test("reports an unknown key", () => {
    const resolution = resolveVariableReference(
      "nope",
      "%nope%",
      REGISTRY,
      "path",
    );
    assert.equal(resolution.ok, false);
    if (resolution.ok) return;
    assert.equal(resolution.issue.code, "value/unknown-variable");
  });

  test("reports a token that no longer matches the registered token", () => {
    const resolution = resolveVariableReference(
      RECIPIENT_FIRST_NAME.key,
      "%something.else%",
      REGISTRY,
      "path",
    );
    assert.equal(resolution.ok, false);
    if (resolution.ok) return;
    assert.equal(resolution.issue.code, "value/variable-token-mismatch");
  });
});

test.describe("findVariableLikeMatches / checkLiteralTextForUnresolvedVariables (7.3)", () => {
  test("the default syntax recognizes percent-delimited tokens", () => {
    const matches = findVariableLikeMatches(
      "Hi %recipient.firstName%, welcome!",
      DEFAULT_VARIABLE_SYNTAX,
    );
    assert.deepEqual(matches, ["%recipient.firstName%"]);
  });

  test("plain text with no variable-like content produces no issues", () => {
    const issues = checkLiteralTextForUnresolvedVariables(
      "Just a normal sentence.",
      REGISTRY,
      "path",
    );
    assert.deepEqual(issues, []);
  });

  test("an unknown percent-style token in literal text is flagged, even though the text is never resolved as a variable", () => {
    const issues = checkLiteralTextForUnresolvedVariables(
      "Save %unknown.token% today",
      REGISTRY,
      "path",
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "value/unresolved-variable-like-text");
  });

  test("a real token spelled out as literal text is still flagged — variables must be atomic nodes", () => {
    const issues = checkLiteralTextForUnresolvedVariables(
      `Hi ${RECIPIENT_FIRST_NAME.token}!`,
      REGISTRY,
      "path",
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "value/unresolved-variable-like-text");
  });
});

test.describe("validateSafeUrl (7.4)", () => {
  test("accepts https, http, tel, and a mailto template with a query string", () => {
    assert.equal(validateSafeUrl("https://example.com/gift", "path").ok, true);
    assert.equal(validateSafeUrl("http://example.com", "path").ok, true);
    assert.equal(validateSafeUrl("tel:+15551234567", "path").ok, true);
    assert.equal(
      validateSafeUrl("mailto:someone@example.com?subject=Hi%20there", "path")
        .ok,
      true,
    );
  });

  test("rejects javascript:, data:, and vbscript: schemes", () => {
    assert.equal(validateSafeUrl("javascript:alert(1)", "path").ok, false);
    assert.equal(
      validateSafeUrl("data:text/html,<script>alert(1)</script>", "path").ok,
      false,
    );
    assert.equal(validateSafeUrl("vbscript:msgbox(1)", "path").ok, false);
  });

  test("rejects an obfuscated scheme using an embedded control character", () => {
    const result = validateSafeUrl("java\tscript:alert(1)", "path");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "value/unsafe-url-control-characters",
      ),
    );
  });

  test("rejects a protocol-relative destination even when relative destinations are allowed", () => {
    const result = validateSafeUrl("//evil.example.com/steal", "path", {
      allowRelative: true,
    });
    assert.equal(result.ok, false);
  });

  test("rejects a malformed absolute URL", () => {
    assert.equal(validateSafeUrl("https://", "path").ok, false);
  });

  test("denies a relative destination unless explicitly allowed, and accepts /path, ?query, and #anchor when allowed", () => {
    assert.equal(validateSafeUrl("/thank-you", "path").ok, false);
    assert.equal(
      validateSafeUrl("/thank-you", "path", { allowRelative: true }).ok,
      true,
    );
    assert.equal(
      validateSafeUrl("#section-2", "path", { allowRelative: true }).ok,
      true,
    );
    assert.equal(
      validateSafeUrl("?ref=email", "path", { allowRelative: true }).ok,
      true,
    );
  });
});

test.describe("validateTemplatedValue (7.5)", () => {
  test("a valid variable used in its allowed context passes", () => {
    const issues = validateTemplatedValue(
      variableSegment(RECIPIENT_FIRST_NAME),
      "text",
      REGISTRY,
      "path",
    );
    assert.deepEqual(issues, []);
  });

  test("a text-only variable used as a URL destination is blocked (URL-context denial)", () => {
    const issues = validateTemplatedValue(
      variableSegment(RECIPIENT_FIRST_NAME),
      "url",
      REGISTRY,
      "path",
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "value/variable-context-not-allowed");
  });

  test("a fully-literal destination is validated as a real URL", () => {
    const safe = validateTemplatedValue(
      literal("https://example.com/donate"),
      "url",
      REGISTRY,
      "path",
    );
    assert.deepEqual(safe, []);
    const unsafe = validateTemplatedValue(
      literal("javascript:alert(1)"),
      "url",
      REGISTRY,
      "path",
    );
    assert.equal(unsafe.length, 1);
    assert.equal(unsafe[0].code, "value/disallowed-url-scheme");
  });

  test("a literal segment mixed with a URL-context variable is not full-URL-parsed, but the variable is still context-checked", () => {
    const value: TemplatedValue = {
      segments: [
        { kind: "literal", value: "https://example.com/?ref=" },
        {
          kind: "variable",
          variableKey: DONATE_URL.key,
          token: DONATE_URL.token,
        },
      ],
    };
    assert.deepEqual(
      validateTemplatedValue(value, "url", REGISTRY, "path"),
      [],
    );
  });
});

test.describe("validateRichTextValue — link destinations and inline variables", () => {
  function paragraphWithLink(destination: TemplatedValue): RichTextValue {
    return {
      kind: "donativus.rich-text",
      version: 1,
      children: [
        {
          type: "paragraph",
          align: "left",
          children: [
            {
              type: "link",
              destination,
              children: [{ type: "text", text: "Donate now", marks: [] }],
            },
          ],
        },
      ],
    };
  }

  test("a safe literal link destination passes", () => {
    const issues = validateRichTextValue(
      paragraphWithLink(literal("https://example.com/donate")),
      REGISTRY,
      "path",
    );
    assert.deepEqual(issues, []);
  });

  test("an unsafe literal link destination is blocked", () => {
    const issues = validateRichTextValue(
      paragraphWithLink(literal("javascript:alert(1)")),
      REGISTRY,
      "path",
    );
    assert.ok(
      issues.some((issue) => issue.code === "value/disallowed-url-scheme"),
    );
  });

  test("a text-only variable used as a link destination is blocked", () => {
    const issues = validateRichTextValue(
      paragraphWithLink(variableSegment(RECIPIENT_FIRST_NAME)),
      REGISTRY,
      "path",
    );
    assert.ok(
      issues.some(
        (issue) => issue.code === "value/variable-context-not-allowed",
      ),
    );
  });
});

/** Builds a minimal starter document with one CTA and one rich-text-with-link node in its section. */
function documentWithCtaAndLink(
  ctaDestination: TemplatedValue,
  ctaLabel: TemplatedValue,
  richTextDestination: TemplatedValue | null,
): VisualDocument {
  const document = createStarterDocument("email");
  const cta: CtaNode = {
    id: "cta-1",
    type: "cta",
    version: 1,
    props: {
      label: {
        kind: "donativus.rich-text",
        version: 1,
        children: [
          {
            type: "paragraph",
            align: "left",
            children: ctaLabel.segments.map((segment) =>
              segment.kind === "literal"
                ? { type: "text" as const, text: segment.value, marks: [] }
                : {
                    type: "variable" as const,
                    variableKey: segment.variableKey,
                    token: segment.token,
                  },
            ),
          },
        ],
      },
      destination: ctaDestination,
      typography: {
        fontFamily: "Arial, sans-serif",
        fontSizePx: 16,
        lineHeightPercent: 150,
        letterSpacingPx: 0,
        fontWeight: "bold",
        color: "#ffffff",
      },
      backgroundColor: "#000000",
      align: "left",
      width: { unit: "auto" },
      borderRadiusPx: 4,
      spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      shadow: null,
    },
  };
  const nodes: VisualBuilderNodeRecord = { ...document.nodes, "cta-1": cta };
  if (richTextDestination) {
    const richText: RichTextNode = {
      id: "rich-text-1",
      type: "rich-text",
      version: 1,
      props: {
        value: {
          kind: "donativus.rich-text",
          version: 1,
          children: [
            {
              type: "paragraph",
              align: "left",
              children: [
                {
                  type: "link",
                  destination: richTextDestination,
                  children: [{ type: "text", text: "Unsubscribe", marks: [] }],
                },
              ],
            },
          ],
        },
        typography: cta.props.typography,
        spacing: cta.props.spacing,
      },
    };
    nodes["rich-text-1"] = richText;
  }
  const section = nodes["section-1"];
  if (section && "children" in section) {
    section.children = richTextDestination
      ? ["cta-1", "rich-text-1"]
      : ["cta-1"];
  }
  return { ...document, nodes };
}

function documentWithSocial(items: SocialLinkItem[]): VisualDocument {
  const document = createStarterDocument("email");
  const social: SocialNode = {
    id: "social-1",
    type: "social",
    version: 1,
    props: {
      items,
      iconStyle: "logo",
      shape: "circle",
      color: "#000000",
      glyphTone: "light",
      iconSizePx: 32,
      gapPx: 8,
      align: "center",
      spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      margin: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
    },
  };
  const nodes: VisualBuilderNodeRecord = {
    ...document.nodes,
    "social-1": social,
  };
  const section = nodes["section-1"];
  if (section && "children" in section) section.children = ["social-1"];
  return { ...document, nodes };
}

test.describe("collectUnsubscribeLinkWarning (7.6)", () => {
  test("warns when no reachable link uses the email-system-link variable", () => {
    const document = documentWithCtaAndLink(
      variableSegment(DONATE_URL),
      literal("Donate"),
      null,
    );
    const warnings = collectUnsubscribeLinkWarning(document, REGISTRY);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, "document/missing-unsubscribe-link");
  });

  test("does not warn once a CTA carries the unsubscribe variable", () => {
    const document = documentWithCtaAndLink(
      variableSegment(UNSUBSCRIBE_URL),
      literal("Unsubscribe"),
      null,
    );
    assert.deepEqual(collectUnsubscribeLinkWarning(document, REGISTRY), []);
  });

  test("does not warn once a rich-text link carries the unsubscribe variable", () => {
    const document = documentWithCtaAndLink(
      variableSegment(DONATE_URL),
      literal("Donate"),
      variableSegment(UNSUBSCRIBE_URL),
    );
    assert.deepEqual(collectUnsubscribeLinkWarning(document, REGISTRY), []);
  });

  test("never warns for landing-page documents", () => {
    const emailDoc = documentWithCtaAndLink(
      variableSegment(DONATE_URL),
      literal("Donate"),
      null,
    );
    const landingDoc: VisualDocument = {
      ...emailDoc,
      mode: "landing-page",
    } as unknown as VisualDocument;
    assert.deepEqual(collectUnsubscribeLinkWarning(landingDoc, REGISTRY), []);
  });
});

test.describe("collectLinkQualityWarnings (7.6)", () => {
  test("warns on an empty CTA destination and an empty CTA label", () => {
    const document = documentWithCtaAndLink(literal(""), literal(""), null);
    const warnings = collectLinkQualityWarnings(document);
    assert.ok(
      warnings.some(
        (warning) => warning.code === "quality/empty-cta-destination",
      ),
    );
    assert.ok(
      warnings.some((warning) => warning.code === "quality/missing-cta-label"),
    );
  });

  test("a populated CTA produces no link-quality warnings", () => {
    const document = documentWithCtaAndLink(
      literal("https://example.com/donate"),
      literal("Donate"),
      null,
    );
    assert.deepEqual(collectLinkQualityWarnings(document), []);
  });

  test("warns per social icon item that has no link", () => {
    const document = documentWithSocial([
      { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
      { id: "b", platform: "instagram", url: "" },
      { id: "c", platform: "x", url: "   " },
    ]);
    const warnings = collectLinkQualityWarnings(document).filter(
      (warning) => warning.code === "quality/empty-social-link",
    );
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every((warning) => warning.nodeId === "social-1"));
    assert.deepEqual(
      warnings.map((warning) => warning.path).sort(),
      ["props.items[1].url", "props.items[2].url"],
    );
  });

  test("a social block whose every item has a link produces no warning", () => {
    const document = documentWithSocial([
      { id: "a", platform: "facebook", url: "https://facebook.com/acme" },
    ]);
    assert.deepEqual(
      collectLinkQualityWarnings(document).filter(
        (warning) => warning.code === "quality/empty-social-link",
      ),
      [],
    );
  });
});

test.describe("validateDocumentVariablesAndUrls — document-wide wiring", () => {
  test("flags an unsafe CTA destination with the node ID attached", () => {
    const document = documentWithCtaAndLink(
      literal("javascript:alert(1)"),
      literal("Click"),
      null,
    );
    const issues = validateDocumentVariablesAndUrls(document, REGISTRY);
    assert.ok(
      issues.some(
        (issue) =>
          issue.code === "value/disallowed-url-scheme" &&
          issue.nodeId === "cta-1",
      ),
    );
  });

  test("a fully valid document produces no issues", () => {
    const document = documentWithCtaAndLink(
      variableSegment(UNSUBSCRIBE_URL),
      literal("Unsubscribe"),
      null,
    );
    assert.deepEqual(validateDocumentVariablesAndUrls(document, REGISTRY), []);
  });

  test("denies a relative CTA destination in an email document but allows it in a landing-page document", () => {
    const emailDoc = documentWithCtaAndLink(
      literal("/thank-you"),
      literal("Continue"),
      null,
    );
    const emailIssues = validateDocumentVariablesAndUrls(emailDoc, REGISTRY);
    assert.ok(
      emailIssues.some(
        (issue) => issue.code === "value/relative-url-not-allowed",
      ),
    );

    const landingDoc = createStarterDocument("landing-page");
    const cta: CtaNode = {
      id: "cta-1",
      type: "cta",
      version: 1,
      props: {
        label: {
          kind: "donativus.rich-text",
          version: 1,
          children: [
            {
              type: "paragraph",
              align: "left",
              children: [{ type: "text", text: "Continue", marks: [] }],
            },
          ],
        },
        destination: literal("/thank-you"),
        typography: {
          fontFamily: "Arial, sans-serif",
          fontSizePx: 16,
          lineHeightPercent: 150,
          letterSpacingPx: 0,
          fontWeight: "bold",
          color: "#ffffff",
        },
        backgroundColor: "#000000",
        align: "left",
        width: { unit: "auto" },
        borderRadiusPx: 4,
        spacing: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
        shadow: null,
      },
    };
    const nodes: VisualBuilderNodeRecord = {
      ...landingDoc.nodes,
      "cta-1": cta,
    };
    const section = nodes["section-1"];
    if (section && "children" in section) section.children = ["cta-1"];
    const withCta: VisualDocument = { ...landingDoc, nodes };
    assert.deepEqual(validateDocumentVariablesAndUrls(withCta, REGISTRY), []);
  });
});
