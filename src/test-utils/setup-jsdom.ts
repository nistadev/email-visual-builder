import { JSDOM } from "jsdom";

/**
 * Node's test runner has no global per-file DOM environment like jsdom-based
 * test runners provide. React/jsdom interaction tests call
 * `installJsdomGlobals()` in a `before` hook and the returned `cleanup()` in
 * `after`, keeping pure Node tests (core/renderers) free of any DOM globals.
 */

const JSDOM_GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "HTMLElement",
  "Element",
  "Node",
  "DocumentFragment",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "InputEvent",
  "MutationObserver",
  "DOMParser",
  "Range",
  "Selection",
  "StaticRange",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
] as const;

/** jsdom does not implement the Clipboard API — polyfilled only when absent so a future jsdom version's real implementation always wins. */
class PolyfillDataTransfer {
  private readonly data = new Map<string, string>();
  setData(type: string, value: string): void {
    this.data.set(type, value);
  }
  getData(type: string): string {
    return this.data.get(type) ?? "";
  }
}

class PolyfillClipboardEvent extends Event {
  clipboardData: PolyfillDataTransfer | null;
  constructor(
    type: string,
    eventInitDict: { clipboardData?: PolyfillDataTransfer | null } = {},
  ) {
    super(type, { bubbles: true, cancelable: true });
    this.clipboardData = eventInitDict.clipboardData ?? null;
  }
}

const CLIPBOARD_POLYFILL_KEYS = ["ClipboardEvent", "DataTransfer"] as const;

export interface JsdomHandle {
  window: Window;
  cleanup: () => Promise<void>;
}

function setGlobal(key: string, value: unknown): void {
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function installJsdomGlobals(): JsdomHandle {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousDescriptors = new Map<string, PropertyDescriptor | undefined>();

  for (const key of JSDOM_GLOBAL_KEYS) {
    previousDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    );
    const value = (window as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      setGlobal(key, value);
    }
  }

  if (typeof globals.requestAnimationFrame !== "function") {
    setGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16),
    );
    setGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));
  }

  for (const key of CLIPBOARD_POLYFILL_KEYS) {
    previousDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    );
  }
  if (typeof globals.DataTransfer !== "function") {
    setGlobal("DataTransfer", PolyfillDataTransfer);
  }
  if (typeof globals.ClipboardEvent !== "function") {
    setGlobal("ClipboardEvent", PolyfillClipboardEvent);
  }

  const hadActEnvironment = "IS_REACT_ACT_ENVIRONMENT" in globals;
  const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;

  return {
    window: window as unknown as Window,
    cleanup: async () => {
      // window.close() queues an async document "load"/"DOMContentLoaded"
      // dispatch (jsdom's Document#close(noQueue=false) path) that resolves
      // over a couple of Promise-chained ticks rather than synchronously.
      // Stripping the jsdom globals below before that dispatch settles left
      // a stray "load" listener running with `window` already deleted from
      // globalThis, throwing "ReferenceError: window is not defined" as
      // async activity attributed to whichever test happened to be current
      // when the listener was registered — a real, if rare, teardown race,
      // not app code. Two macrotask turns are enough to drain jsdom's
      // internal microtask-chained resource queue (there's nothing to load
      // in these fixture documents) before we delete the globals it needs.
      window.close();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      for (const key of [...JSDOM_GLOBAL_KEYS, ...CLIPBOARD_POLYFILL_KEYS]) {
        const descriptor = previousDescriptors.get(key);
        if (descriptor === undefined) {
          delete globals[key];
        } else {
          Object.defineProperty(globalThis, key, descriptor);
        }
      }
      if (hadActEnvironment) {
        globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      } else {
        delete globals.IS_REACT_ACT_ENVIRONMENT;
      }
    },
  };
}
