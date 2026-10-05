import assert from "node:assert/strict";
import test from "node:test";
import { resolveVariableMenuPosition } from "./variable-token-menu.js";

test("variable token menus flip above a trigger near the viewport bottom", () => {
  const position = resolveVariableMenuPosition(
    { top: 744, bottom: 772, right: 1132 },
    { width: 224, height: 256 },
    { width: 1200, height: 800 },
  );

  assert.equal(position.placement, "above");
  assert.equal(position.top, 484);
  assert.equal(position.maxHeight, 732);
});

test("variable token menus stay inside the horizontal viewport gutter", () => {
  const position = resolveVariableMenuPosition(
    { top: 120, bottom: 148, right: 1196 },
    { width: 352, height: 160 },
    { width: 1200, height: 800 },
  );

  assert.equal(position.placement, "below");
  assert.equal(position.left, 840);
});

test("variable token menus use the side with more room and constrain their height", () => {
  const position = resolveVariableMenuPosition(
    { top: 96, bottom: 124, right: 240 },
    { width: 224, height: 256 },
    { width: 400, height: 280 },
  );

  assert.equal(position.placement, "below");
  assert.equal(position.top, 128);
  assert.equal(position.maxHeight, 144);
});

test("variable token menus settle when neither side fits the menu", () => {
  const trigger = { top: 240, bottom: 260, right: 900 };
  const viewport = { width: 1440, height: 500 };
  const cssMaxHeight = 256;
  const first = resolveVariableMenuPosition(
    trigger,
    { width: 224, height: cssMaxHeight },
    viewport,
  );
  const renderedHeight = Math.min(
    cssMaxHeight,
    first.maxHeight ?? cssMaxHeight,
  );
  const second = resolveVariableMenuPosition(
    trigger,
    { width: 224, height: renderedHeight },
    viewport,
  );

  assert.deepEqual(second, first);
});
