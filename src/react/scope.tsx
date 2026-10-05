// Marks the subtrees the editor owns. The standalone stylesheet confines
// every rule to this class, so a host that uses it instead of running
// Tailwind and daisyUI gets none of those styles on its own markup. The
// wrapper is `display: contents`: it carries theme variables down without
// taking part in layout.

import type { ReactNode, ReactPortal } from "react";
import { createPortal } from "react-dom";

export const SCOPE_CLASS = "donativus-vb-scope";

export function Scope({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className={SCOPE_CLASS} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/** Portaled chrome leaves the editor subtree, so it needs its own scope. */
export function createScopedPortal(
  children: ReactNode,
  container: Element = document.body,
): ReactPortal {
  return createPortal(<Scope>{children}</Scope>, container);
}
