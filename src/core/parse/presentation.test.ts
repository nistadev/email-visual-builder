import assert from "node:assert/strict";
import test from "node:test";
import { VISUAL_DOCUMENT_LIMITS } from "../limits.js";
import {
  parseBackground,
  parseBorder,
  parseHorizontalAlignment,
  parseResponsiveStackBehavior,
  parseSpacing,
  parseTypography,
  parseVerticalAlignment,
  parseWidth,
} from "./presentation.js";

test.describe("parseSpacing", () => {
  test("accepts a fully-specified valid value", () => {
    const result = parseSpacing(
      { topPx: 4, rightPx: 8, bottomPx: 12, leftPx: 16 },
      "spacing",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      topPx: 4,
      rightPx: 8,
      bottomPx: 12,
      leftPx: 16,
    });
  });

  test("rejects a non-object, a negative value, and a raw CSS string", () => {
    assert.equal(parseSpacing(null, "spacing").ok, false);
    assert.equal(
      parseSpacing({ topPx: -1, rightPx: 0, bottomPx: 0, leftPx: 0 }, "spacing")
        .ok,
      false,
    );
    assert.equal(parseSpacing("8px 4px", "spacing").ok, false);
  });
});

test.describe("parseTypography", () => {
  const valid = {
    fontFamily: "Georgia, serif",
    fontSizePx: 18,
    lineHeightPercent: 140,
    letterSpacingPx: 0.5,
    fontWeight: "bold",
    color: "#112233",
  };

  test("accepts a fully-specified valid value", () => {
    const result = parseTypography(valid, "typography");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, valid);
  });

  test("accepts every inspector font-weight option", () => {
    for (const fontWeight of ["thin", "normal", "semibold", "bold"]) {
      assert.equal(
        parseTypography({ ...valid, fontWeight }, "typography").ok,
        true,
      );
    }
  });

  test("rejects an invalid fontWeight enum, an out-of-range font size, and a non-hex color", () => {
    assert.equal(
      parseTypography({ ...valid, fontWeight: "black" }, "typography").ok,
      false,
    );
    assert.equal(
      parseTypography({ ...valid, fontSizePx: 0 }, "typography").ok,
      false,
    );
    assert.equal(
      parseTypography({ ...valid, color: "blue" }, "typography").ok,
      false,
    );
  });

  test("rejects a raw CSS shorthand string instead of a structured value", () => {
    assert.equal(parseTypography("bold 18px Georgia", "typography").ok, false);
  });
});

test.describe("parseWidth", () => {
  test("accepts px within the documented dimension ceiling and percent within 0-100", () => {
    assert.equal(parseWidth({ unit: "px", value: 600 }, "width").ok, true);
    assert.equal(parseWidth({ unit: "percent", value: 100 }, "width").ok, true);
  });

  test("rejects an unknown unit, a percent over 100, and a px value over the dimension ceiling", () => {
    assert.equal(parseWidth({ unit: "em", value: 10 }, "width").ok, false);
    assert.equal(
      parseWidth({ unit: "percent", value: 101 }, "width").ok,
      false,
    );
    assert.equal(
      parseWidth(
        { unit: "px", value: VISUAL_DOCUMENT_LIMITS.maxDimensionPx + 1 },
        "width",
      ).ok,
      false,
    );
  });
});

test.describe("parseBorder", () => {
  test("accepts a fully-specified valid value", () => {
    const result = parseBorder(
      { widthPx: 2, style: "dashed", color: "#000000", radiusPx: 8 },
      "border",
    );
    assert.equal(result.ok, true);
  });

  test('accepts style "none" and rejects an unrecognized style keyword', () => {
    assert.equal(
      parseBorder(
        { widthPx: 0, style: "none", color: "#000000", radiusPx: 0 },
        "border",
      ).ok,
      true,
    );
    assert.equal(
      parseBorder(
        { widthPx: 1, style: "groove", color: "#000000", radiusPx: 0 },
        "border",
      ).ok,
      false,
    );
  });

  test("rejects a negative radius", () => {
    assert.equal(
      parseBorder(
        { widthPx: 1, style: "solid", color: "#000000", radiusPx: -1 },
        "border",
      ).ok,
      false,
    );
  });
});

test.describe("parseBackground", () => {
  test("accepts a null color (transparent) and a valid hex color", () => {
    assert.equal(parseBackground({ color: null }, "background").ok, true);
    assert.equal(parseBackground({ color: "#ffffff" }, "background").ok, true);
  });

  test("rejects a non-hex color value", () => {
    assert.equal(parseBackground({ color: "white" }, "background").ok, false);
  });
});

test.describe("parseHorizontalAlignment / parseVerticalAlignment", () => {
  test("accepts each registered keyword", () => {
    for (const value of ["left", "center", "right"]) {
      assert.equal(parseHorizontalAlignment(value, "align").ok, true);
    }
    for (const value of ["top", "middle", "bottom"]) {
      assert.equal(parseVerticalAlignment(value, "align").ok, true);
    }
  });

  test("rejects values from the other axis and arbitrary strings", () => {
    assert.equal(parseHorizontalAlignment("top", "align").ok, false);
    assert.equal(parseVerticalAlignment("left", "align").ok, false);
    assert.equal(parseHorizontalAlignment("justify", "align").ok, false);
  });
});

test.describe("parseResponsiveStackBehavior", () => {
  test("accepts the two registered keywords and rejects anything else", () => {
    assert.equal(
      parseResponsiveStackBehavior("stack", "responsiveStack").ok,
      true,
    );
    assert.equal(
      parseResponsiveStackBehavior("no-stack", "responsiveStack").ok,
      true,
    );
    assert.equal(
      parseResponsiveStackBehavior("wrap", "responsiveStack").ok,
      false,
    );
  });
});
