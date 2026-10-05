// Confines a compiled stylesheet to `.donativus-vb-scope`, so the standalone
// build can carry Tailwind's reset and daisyUI's component classes without
// any of them reaching the host page.

const SCOPE = ".donativus-vb-scope";
const ROOT_SELECTOR = /:root|:host|^html$|^body$/;
const UNSCOPED_AT_RULES = new Set(["keyframes", "font-face", "property"]);

function insideUnscopedAtRule(rule) {
  for (let node = rule.parent; node; node = node.parent) {
    if (node.type === "atrule" && UNSCOPED_AT_RULES.has(node.name)) return true;
  }
  return false;
}

/** Nested rules resolve against a parent that is already scoped. */
function isNested(rule) {
  return rule.parent?.type === "rule";
}

export function scopeSelector(selector) {
  if (selector.includes(SCOPE)) return [selector];
  // A theme attribute may sit on the scope itself or on any ancestor, so the
  // editor follows the host page's own light/dark switch.
  const theme = /^\[data-theme(=[^\]]+)?\]$/.exec(selector);
  if (theme) return [`${SCOPE}${selector}`, `${selector} ${SCOPE}`];
  if (ROOT_SELECTOR.test(selector)) {
    return [selector.replace(/:root|:host|^html$|^body$/g, SCOPE)];
  }
  return [`:where(${SCOPE}) ${selector}`];
}

export const scopePlugin = {
  postcssPlugin: "email-visual-builder-scope",
  Rule(rule) {
    if (isNested(rule) || insideUnscopedAtRule(rule)) return;
    rule.selectors = [...new Set(rule.selectors.flatMap(scopeSelector))];
  },
};
