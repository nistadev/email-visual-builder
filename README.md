# email-visual-builder

A visual email builder for React. Authors drag blocks onto a canvas, edit text
in place, and you get back a versioned JSON document plus deterministic,
email-safe HTML.

- **Owned document model.** A versioned, validated JSON document with ordered
  migrations. No editor-internal state is ever persisted.
- **Headless core.** Parsing, validation, commands, undo/redo and export run in
  Node with no React or DOM dependency, so a server can validate and render the
  same document the editor produced.
- **Deterministic export.** The same document always renders byte-identical
  HTML. Email output is nested tables with inline styles; nothing depends on the
  canvas DOM.
- **React editor.** Canvas, block library, layers, inspector, rich text with
  inline color and font, variables, image editing, and a device preview.
- **Two modes.** Email is the primary one. A landing-page mode renders the same
  blocks as semantic HTML.

## Install

```sh
pnpm add email-visual-builder
# or
npm install email-visual-builder
```

React 19 and `react-dom` 19 are peer dependencies. The editor chrome is styled
with [Tailwind CSS 4](https://tailwindcss.com) and
[daisyUI 5](https://daisyui.com) semantic classes, so the host app needs both,
and its Tailwind build must scan this package:

```css
@import "tailwindcss";
@plugin "daisyui";
@source "../node_modules/email-visual-builder/dist";
@import "email-visual-builder/styles.css";
```

## Entry points

| Import                            | Contents                                                                              | React/DOM |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------- |
| `email-visual-builder/core`       | Document types, parsing, migrations, registries, commands, the controller, validation | No        |
| `email-visual-builder/renderers`  | Email and landing-page HTML export                                                    | No        |
| `email-visual-builder/react`      | Provider, editor UI, presets, rich-text adapter                                       | Yes       |
| `email-visual-builder/styles.css` | Editor chrome styles                                                                  | —         |

## Usage

### Registries and variables

Variables are supplied by the host; the package ships none of its own. Build
one registry set and share it between the editor and the server, so the editor
never accepts a document the server refuses.

```ts
// registries.ts
import {
  createBuilderRegistries,
  createVariableRegistry,
  type BuilderRegistries,
  type VariableDefinition,
} from "email-visual-builder/core";
import { DEFAULT_RENDERER_REGISTRIES } from "email-visual-builder/renderers";

export const variables: readonly VariableDefinition[] = [
  {
    key: "recipient.firstName",
    token: "%recipient.firstName%",
    label: "Recipient first name",
    sampleValue: "Alex",
    allowedContexts: ["text"],
  },
];

export function buildRegistries(): BuilderRegistries {
  const variableRegistry = createVariableRegistry(variables);
  if (!variableRegistry.ok) throw new Error("Invalid variable definitions");
  const registries = createBuilderRegistries({
    blocks: DEFAULT_RENDERER_REGISTRIES.blocks,
    modes: DEFAULT_RENDERER_REGISTRIES.modes,
    inspectorControls: DEFAULT_RENDERER_REGISTRIES.inspectorControls,
    variables: variableRegistry.value,
  });
  if (!registries.ok) throw new Error("Invalid registries");
  return registries.value;
}
```

### Editor

```tsx
import { useMemo } from "react";
import {
  BuilderController,
  createStarterDocument,
} from "email-visual-builder/core";
import { EmailVisualBuilder } from "email-visual-builder/react";
import { buildRegistries, variables } from "./registries";

export function TemplateEditor() {
  const registries = useMemo(buildRegistries, []);
  const controller = useMemo(
    () =>
      new BuilderController(createStarterDocument("email", registries), {
        registries,
      }),
    [registries],
  );

  return (
    <div style={{ height: "100dvh" }}>
      <EmailVisualBuilder
        controller={controller}
        registries={registries}
        variables={variables}
      />
    </div>
  );
}
```

The editor fills its container, so give the container a height.

### Export

```ts
import { exportVisualDocument } from "email-visual-builder/renderers";
import { buildRegistries } from "./registries";

const result = exportVisualDocument(savedDocument, buildRegistries());

if (result.errors.length > 0) {
  // The document is invalid; `result.html` is null.
} else {
  await send({ html: result.html });
  await store({ json: result.json });
}
```

`exportVisualDocument` accepts untrusted input: it migrates, parses and
validates before rendering, and returns `errors` and `warnings` instead of
throwing. Run it on the server against what the client submitted rather than
trusting HTML produced in the browser.

## Fonts

Font choices are system font stacks only. No font file is ever fetched, so an
exported email makes no third-party request and loses nothing in clients that
strip remote fonts. The face a recipient sees is the first installed family in
the stack, which varies by platform.

## Email compatibility

The email renderer targets a constrained, tested table and inline-style subset
rather than claiming identical output in every client.

- Layout is nested `role="presentation"` tables with explicit width, padding and
  border attributes and inline styles. No grid, flexbox or external stylesheet.
- Columns stack through one `@media (max-width:480px)` rule. Clients that ignore
  `<style>` render the fixed desktop layout instead.
- Image and column dimensions are also set as HTML attributes, because Outlook
  desktop ignores `max-width`.
- `letter-spacing` and `border-radius` are ignored by Outlook desktop; a button
  renders there as a plain rectangular link.
- No script, iframe, form, embedded image, `@font-face` or animation is ever
  emitted. The document schema has no way to express them.

## Document format identifiers

Stored documents carry `kind: "donativus.visual-document"` and rich text
carries `kind: "donativus.rich-text"`. These are stable format identifiers, kept
for compatibility with documents saved by [Donativus](https://donativus.com),
the fundraising platform by [Aatsin](https://aatsin.com) this package was
extracted from. CSS classes use the `donativus-vb-` prefix for the same reason.

## Development

```sh
pnpm install
pnpm test          # node:test through tsx
pnpm check-types
pnpm build
pnpm storybook     # interactive editor at http://localhost:6007
```

## License

[Apache-2.0](./LICENSE). Bundled social platform glyphs come from
[Simple Icons](https://simpleicons.org) (CC0); the marks themselves remain
trademarks of their owners.
