import assert from "node:assert/strict";
import test from "node:test";
import { installJsdomGlobals, type JsdomHandle } from "../test-utils/index.js";

let jsdom: JsdomHandle;

test.describe("React/jsdom interaction test setup", () => {
  test.before(() => {
    jsdom = installJsdomGlobals();
  });

  test.after(async () => {
    await jsdom.cleanup();
  });

  test("renders and clicks a React component under jsdom", async () => {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const userEvent = (await import("@testing-library/user-event")).default;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Counter() {
      const [count, setCount] = React.useState(0);
      return React.createElement(
        "button",
        { onClick: () => setCount((value) => value + 1) },
        `count:${count}`,
      );
    }

    act(() => {
      root.render(React.createElement(Counter));
    });

    const button = container.querySelector("button");
    assert.ok(button);
    assert.equal(button.textContent, "count:0");

    const user = userEvent.setup();
    await act(async () => {
      await user.click(button);
    });

    assert.equal(button.textContent, "count:1");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
