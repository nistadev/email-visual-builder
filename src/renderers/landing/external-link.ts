// External-link target/rel policy (design.md decision #12, task 10.4). A
// destination counts as "external" only when it is a literal absolute
// `http(s)` URL — relative/anchor destinations stay same-page and `mailto:`/
// `tel:` never open a browsing context, so none of those get `target`/`rel`.
// A destination built from a variable segment cannot be classified at
// render time (its resolved value is unknown until send/publish), so it is
// conservatively treated as internal.

const ABSOLUTE_HTTP_PATTERN = /^https?:\/\//i;

export function isExternalHref(href: string): boolean {
  return ABSOLUTE_HTTP_PATTERN.test(href);
}

/** `rel="noopener noreferrer"` prevents the new tab from accessing `window.opener` on the originating page. */
export function externalLinkAttributes(href: string): string {
  return isExternalHref(href)
    ? ' target="_blank" rel="noopener noreferrer"'
    : "";
}
