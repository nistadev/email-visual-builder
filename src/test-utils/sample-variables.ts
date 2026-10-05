// A representative host variable catalogue for tests: recipient fields that
// are text-only, some that may also be a link or image source, and one
// system link. The package itself ships no product-specific variables.

import type { VariableDefinition } from "../types/index.js";

const RECIPIENT_FIELDS: readonly {
  key: string;
  label: string;
  sampleValue: string;
  contexts: VariableDefinition["allowedContexts"];
}[] = [
  {
    key: "firstName",
    label: "Recipient first name",
    sampleValue: "Alex",
    contexts: ["text"],
  },
  {
    key: "name",
    label: "Recipient full name",
    sampleValue: "Alex Morgan",
    contexts: ["text"],
  },
  {
    key: "email",
    label: "Recipient email",
    sampleValue: "alex.morgan@example.com",
    contexts: ["text"],
  },
  {
    key: "surnames",
    label: "Recipient surnames",
    sampleValue: "Morgan Rivera",
    contexts: ["text"],
  },
  {
    key: "surname1",
    label: "Recipient first surname",
    sampleValue: "Morgan",
    contexts: ["text"],
  },
  {
    key: "surname2",
    label: "Recipient second surname",
    sampleValue: "Rivera",
    contexts: ["text"],
  },
  {
    key: "companyName",
    label: "Company name",
    sampleValue: "Acme Foundation",
    contexts: ["text"],
  },
  {
    key: "companyWebsiteUrl",
    label: "Company website URL",
    sampleValue: "https://acme.example",
    contexts: ["text", "url"],
  },
  {
    key: "companyEmail",
    label: "Company support email",
    sampleValue: "hello@acme.example",
    contexts: ["text", "url"],
  },
  {
    key: "companyLogoUrl",
    label: "Company logo URL",
    sampleValue: "https://acme.example/logo.png",
    contexts: ["text", "url", "image-url"],
  },
];

export const SAMPLE_VARIABLE_DEFINITIONS: readonly VariableDefinition[] = [
  ...RECIPIENT_FIELDS.map((field): VariableDefinition => ({
    key: `recipient.${field.key}`,
    token: `%recipient.${field.key}%`,
    label: field.label,
    sampleValue: field.sampleValue,
    allowedContexts: field.contexts,
  })),
  {
    key: "unsubscribe_url",
    token: "%unsubscribe_url%",
    label: "Unsubscribe link",
    sampleValue: "https://acme.example/unsubscribe",
    allowedContexts: ["url", "email-system-link"],
  },
];
