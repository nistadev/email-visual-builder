// Compiles `styles/standalone.css` into `dist/react/standalone.css`: the
// editor's own styles plus the Tailwind utilities and daisyUI components it
// uses, with every rule confined to `.donativus-vb-scope` so nothing reaches
// the host page.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import { scopePlugin } from "./scope-css.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const from = `${root}styles/standalone.css`;
const to = `${root}dist/react/standalone.css`;

const compiled = await postcss([tailwind()]).process(
  readFileSync(from, "utf8"),
  { from, to },
);
const scoped = await postcss([scopePlugin]).process(compiled.css, {
  from: to,
  to,
});
mkdirSync(`${root}dist/react`, { recursive: true });
writeFileSync(to, scoped.css);
