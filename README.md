# email-visual-builder

<p align="center">
  <img src="https://raw.githubusercontent.com/nistadev/email-visual-builder/main/docs/assets/hero.png" alt="email-visual-builder: a drag-and-drop email editor for React" width="100%">
</p>

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

React 19 and `react-dom` 19 are the only peer dependencies. Then load the
styles one of two ways.

**Without daisyUI.** Import the self-contained stylesheet. Nothing else is
needed, whether or not your app uses Tailwind:

```ts
import "email-visual-builder/standalone.css";
```

Every rule in it is confined to the editor, so it does not restyle your page or
collide with your own Tailwind build, and none of your classes need to match
its names. It is about 23 kB gzipped.

**With Tailwind CSS 4 and daisyUI 5.** If your app already runs both, let them
style the editor so it shares your theme, and import only the editor chrome:

```css
@import "tailwindcss";
@plugin "daisyui";
@source "../node_modules/email-visual-builder/dist";
@import "email-visual-builder/styles.css";
```

Use one or the other, not both.

## Entry points

| Import                                | Contents                                                                              | React/DOM |
| ------------------------------------- | ------------------------------------------------------------------------------------- | --------- |
| `email-visual-builder/core`           | Document types, parsing, migrations, registries, commands, the controller, validation | No        |
| `email-visual-builder/renderers`      | Email and landing-page HTML export                                                    | No        |
| `email-visual-builder/react`          | Provider, editor UI, presets, rich-text adapter                                       | Yes       |
| `email-visual-builder/standalone.css` | All editor styles in one file, for hosts without daisyUI                              | —         |
| `email-visual-builder/styles.css`     | Editor chrome only, for hosts that run Tailwind and daisyUI                           | —         |

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
import "email-visual-builder/standalone.css";
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

## Guide

### How it fits together

1. The **document** is plain JSON: a flat map of nodes with a root, a mode
   (`email` or `landing-page`), and settings. This is what you store.
2. The **controller** holds a document in memory. Every edit is a validated
   command, so the document can never reach a state the parser would reject,
   and undo/redo comes for free.
3. The **editor** is a React UI bound to a controller.
4. The **renderer** turns a document into HTML. It never reads the editor.

Store the JSON as the source of truth and render HTML from it when you send.
Do not store HTML and try to edit it later.

### Saving and loading

```ts
// Save: validate and serialize what the editor holds.
const result = controller.export();
if (result.errors.length === 0) {
  await api.save({ document: result.json, html: result.html });
}

// Load: parse what you stored, then hand it to a controller.
const parsed = parseVisualDocument(JSON.parse(stored), registries);
if (parsed.ok) controller.loadDocument(parsed.value);
```

`controller.subscribe(listener)` fires on every change, which is the place to
track unsaved changes. `controller.undo()`, `redo()`, `canUndo()` and
`canRedo()` drive your own history buttons if you are not using the built-in
toolbar.

### Blocks

| Block       | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `section`   | A full-width band with background, padding and width       |
| `columns`   | Side-by-side columns that stack on narrow screens          |
| `heading`   | A heading, levels 1 to 6                                   |
| `rich-text` | Paragraphs, lists, links, inline color and font, variables |
| `image`     | An image, uploaded or by URL, optionally linked            |
| `cta`       | A button with a destination                                |
| `divider`   | A horizontal rule                                          |
| `spacer`    | Vertical space                                             |
| `social`    | A row of social profile icons                              |

Blocks obey structural rules: the document holds sections, and a section holds
content blocks or columns. The editor will not let an author drop a block where it is not allowed,
and the parser rejects a stored document that breaks the rules.

### Variables

A variable is a placeholder your sending system replaces per recipient. The
builder treats it as one atomic token: an author cannot half-delete it or
mistype it, and the export writes the exact `token` you configured.

```ts
const variables: VariableDefinition[] = [
  {
    key: "recipient.firstName",
    token: "%recipient.firstName%",
    label: "Recipient first name",
    sampleValue: "Alex",
    allowedContexts: ["text"],
  },
  {
    key: "unsubscribe_url",
    token: "%unsubscribe_url%",
    label: "Unsubscribe link",
    allowedContexts: ["url", "email-system-link"],
  },
];
```

`allowedContexts` decides where a variable is offered:

| Context             | Offered in                               |
| ------------------- | ---------------------------------------- |
| `text`              | Headings, rich text, button labels       |
| `url`               | Link and button destinations             |
| `image-url`         | Image sources                            |
| `email-system-link` | Links the email must carry, e.g. opt-out |

`sampleValue` is what the editor shows when the author turns on sample values.
The token syntax is yours to choose; the builder never substitutes values.

### Images

The builder does not know where your files live. Pass an `assetAdapter` and it
calls you with the file to upload:

```ts
const assetAdapter: AssetAdapter = {
  maxImageBytes: 1024 * 1024,
  async uploadImage(file, context) {
    const response = await uploadToYourStorage(file);
    if (!response.ok) return { ok: false, error: "Upload failed. Try again." };
    return {
      ok: true,
      asset: {
        url: response.url,
        filename: file.name,
        mimeType: file.type,
      },
    };
  },
};
```

Return `{ ok: false }` for expected failures instead of throwing, so the author
can retry. Every upload must produce a new URL: undo restores the previous
asset, so the old URL has to keep working. Without an adapter, authors can
still set an image by pasting its URL.

Authors can crop, rotate and resize an image before it is uploaded.

### Email metadata

`EmailVisualBuilder` frames the canvas as a message window. Sender, subject and
template name are yours; the builder only displays and edits them.

```tsx
<EmailVisualBuilder
  controller={controller}
  registries={registries}
  variables={variables}
  assetAdapter={assetAdapter}
  templateName={name}
  onTemplateNameChange={setName}
  senderName="Donativus"
  senderEmail="hello@donativus.com"
  subject={subject}
  onSubjectChange={setSubject}
  hasUnsavedChanges={dirty}
  toolbarActions={<button onClick={save}>Save</button>}
/>
```

### Layout

The editor adapts to the width of its container, not the window. Below 900px
the side panels collapse into toggles. Force one with `layout="wide"` or
`layout="narrow"`; the default is `"auto"`.

### Translations

Every string in the editor comes from a label. Override any subset:

```tsx
<EmailVisualBuilder
  controller={controller}
  labels={{ formatBold: "Negrita", addVariable: "Añadir variable" }}
/>
```

`DEFAULT_BUILDER_LABELS` lists every key with its English default.

### Theming

The editor is drawn with semantic color tokens (`--color-base-100`,
`--color-base-content`, `--color-primary` and so on).

- With `standalone.css` it ships a light and a dark theme. Set
  `data-theme="dark"` on any ancestor, such as `<html>`, to switch. To match
  your brand, override the tokens on `.donativus-vb-scope`:

  ```css
  .donativus-vb-scope {
    --color-primary: #e75480;
    --color-primary-content: #ffffff;
    --radius-field: 0.5rem;
  }
  ```

- With your own daisyUI build it follows whatever theme your page sets.

Colors an author picks for the email itself are stored in the document and are
never affected by the host theme.

### Building your own editor

The presets are assembled from exported parts. Compose them yourself when you
need a different arrangement:

```tsx
<BuilderProvider controller={controller} mode="email" registries={registries}>
  <Toolbar />
  <Workspace library={<BlockLibrary />} inspector={<Inspector />}>
    <Canvas />
  </Workspace>
</BuilderProvider>
```

`useBuilderSelector`, `useNode`, `useSelectedNodeId` and `useNodeActions` read
and change the document from your own components.

### Importing from Unlayer

`importUnlayerEmailDesign(design)` converts the supported subset of an Unlayer
email design into a document. Unsupported tools are reported in `warnings`
rather than carried over as raw HTML.

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
extracted from. CSS classes use the `donativus-vb-` prefix for the same reason,
including `.donativus-vb-scope`, the wrapper the editor and its floating menus
render inside.

## Used by

<table>
  <tr>
    <td align="center" width="280">
      <a href="https://donativus.com">
        <img src="https://raw.githubusercontent.com/nistadev/email-visual-builder/main/docs/assets/donativus.png" alt="Donativus" width="200">
      </a>
      <br>
      <sub>Fundraising platform for nonprofits</sub>
    </td>
    <td align="center" width="280">
      <a href="https://circuitius.com">
        <img src="https://raw.githubusercontent.com/nistadev/email-visual-builder/main/docs/assets/circuitius.png" alt="Circuitius" width="200">
      </a>
      <br>
      <sub>Operating system for leisure circuits</sub>
    </td>
  </tr>
</table>

Built and maintained with the support of [Aatsin](https://aatsin.com). Using
it in production? Open a pull request to add your project.

## Development

```sh
pnpm install
pnpm test          # node:test through tsx
pnpm check-types
pnpm build
pnpm storybook     # interactive editor at http://localhost:6007
pnpm sandbox       # the editor with standalone.css only, after pnpm build
```

## License

[Apache-2.0](./LICENSE). Bundled social platform glyphs come from
[Simple Icons](https://simpleicons.org) (CC0); the marks themselves remain
trademarks of their owners.
