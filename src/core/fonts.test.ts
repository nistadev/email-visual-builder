import assert from "node:assert/strict";
import test from "node:test";
import { escapeCssValue } from "../renderers/escape.js";
import { FONT_CATALOGUE, FONT_GROUPS, isCatalogueFont } from "./fonts.js";

const GENERIC_FAMILIES = [
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
];

test("every catalogue font stack ends in a generic family", () => {
  for (const option of FONT_CATALOGUE) {
    const last = option.value.split(",").pop()?.trim() ?? "";
    assert.ok(
      GENERIC_FAMILIES.includes(last),
      `${option.label} ends in "${last}"`,
    );
  }
});

test("a catalogue font stack survives the renderers' quote stripping", () => {
  for (const option of FONT_CATALOGUE) {
    for (const family of escapeCssValue(option.value).split(",")) {
      for (const word of family.trim().split(/\s+/)) {
        assert.match(word, /^[A-Za-z][A-Za-z-]*$/, `${option.label}: ${word}`);
      }
    }
  }
});

test("catalogue values and labels are unique and grouped", () => {
  const values = FONT_CATALOGUE.map((option) => option.value);
  const labels = FONT_CATALOGUE.map((option) => option.label);
  assert.equal(new Set(values).size, values.length);
  assert.equal(new Set(labels).size, labels.length);
  for (const option of FONT_CATALOGUE)
    assert.ok(FONT_GROUPS.includes(option.group));
});

test("documents saved with the original eight fonts still match an entry", () => {
  for (const value of [
    "Arial, sans-serif",
    "Helvetica, Arial, sans-serif",
    "Georgia, serif",
    '"Times New Roman", Times, serif',
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    '"Trebuchet MS", sans-serif',
    '"Courier New", monospace',
  ]) {
    assert.equal(isCatalogueFont(value), true, value);
  }
  assert.equal(isCatalogueFont("Wingdings"), false);
});
