import assert from "node:assert/strict";
import test from "node:test";
import { resolveSocialItemStyle } from "./social-icon-style.js";

test.describe("resolveSocialItemStyle", () => {
  test("the icon's visual footprint (wrapperSizePx) is the same size for every style", () => {
    const iconSizePx = 40;
    const sizes = (
      ["logo", "filled", "filled-color", "no-color"] as const
    ).map(
      (iconStyle) =>
        resolveSocialItemStyle(
          "facebook",
          iconStyle,
          "circle",
          iconSizePx,
          "#123456",
          "light",
        ).wrapperSizePx,
    );
    assert.deepEqual(sizes, [iconSizePx, iconSizePx, iconSizePx, iconSizePx]);
  });

  test("filled styles inset the glyph within the fixed-size shape rather than growing the shape", () => {
    const style = resolveSocialItemStyle(
      "facebook",
      "filled",
      "circle",
      40,
      "#123456",
      "light",
    );
    assert.equal(style.wrapperSizePx, 40);
    assert.ok(
      style.imgSizePx < style.wrapperSizePx,
      "expected the glyph to be smaller than the shape it sits inside",
    );
  });

  test("logo and no-color draw the glyph at the full requested size, no inset", () => {
    for (const iconStyle of ["logo", "no-color"] as const) {
      const style = resolveSocialItemStyle(
        "facebook",
        iconStyle,
        "circle",
        40,
        "#123456",
        "light",
      );
      assert.equal(style.imgSizePx, 40);
    }
  });
});
