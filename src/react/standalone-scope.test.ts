import assert from "node:assert/strict";
import test from "node:test";
import postcss from "postcss";
// @ts-expect-error -- build script, plain ESM without declarations
import { scopePlugin } from "../../scripts/scope-css.mjs";

async function scoped(css: string): Promise<string> {
  const result = await postcss([scopePlugin]).process(css, { from: undefined });
  return result.css.replace(/\s+/g, " ").trim();
}

test("standalone styles cannot reach host markup", async () => {
  assert.equal(
    await scoped(".btn, button { color: red }"),
    ":where(.donativus-vb-scope) .btn, :where(.donativus-vb-scope) button { color: red }",
  );
  assert.equal(
    await scoped("*, ::before { margin: 0 }"),
    ":where(.donativus-vb-scope) *, :where(.donativus-vb-scope) ::before { margin: 0 }",
  );
});

test("page-level selectors become the scope itself", async () => {
  assert.equal(
    await scoped(":root, :host { --x: 1 } html { line-height: 1.5 }"),
    ".donativus-vb-scope { --x: 1 } .donativus-vb-scope { line-height: 1.5 }",
  );
});

test("the editor follows a theme attribute on itself or an ancestor", async () => {
  assert.equal(
    await scoped("[data-theme=dark] { --x: 1 }"),
    ".donativus-vb-scope[data-theme=dark], [data-theme=dark] .donativus-vb-scope { --x: 1 }",
  );
});

test("keyframes and nested rules are left as written", async () => {
  assert.equal(
    await scoped("@keyframes spin { from { rotate: 0deg } }"),
    "@keyframes spin { from { rotate: 0deg } }",
  );
  assert.equal(
    await scoped(".btn { &:hover { color: red } }"),
    ":where(.donativus-vb-scope) .btn { &:hover { color: red } }",
  );
});
