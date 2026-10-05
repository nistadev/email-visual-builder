import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeCssValue,
  escapeHtmlAttribute,
  escapeHtmlText,
  serializeInlineStyle,
} from "./escape.js";
import { typographyStyleEntries } from "./style.js";

test.describe("escapeHtmlText", () => {
  test("escapes markup metacharacters", () => {
    assert.equal(
      escapeHtmlText('<script>alert("hi")</script>'),
      '&lt;script&gt;alert("hi")&lt;/script&gt;',
    );
  });

  test("leaves plain text untouched", () => {
    assert.equal(escapeHtmlText("Every gift matters."), "Every gift matters.");
  });
});

test.describe("escapeHtmlAttribute", () => {
  test("escapes ampersand, angle brackets, and double quotes", () => {
    assert.equal(
      escapeHtmlAttribute(`Say "hi" & <bye>`),
      "Say &quot;hi&quot; &amp; &lt;bye&gt;",
    );
  });
});

test.describe("escapeCssValue", () => {
  test("strips characters that could break out of a style declaration", () => {
    assert.equal(
      escapeCssValue('Arial";}body{background:url(x)//'),
      "Arialbodybackground:url(x)//",
    );
  });

  test("leaves an ordinary font stack and hex color untouched", () => {
    assert.equal(escapeCssValue("Georgia, serif"), "Georgia, serif");
    assert.equal(escapeCssValue("#112233"), "#112233");
  });
});

test.describe("serializeInlineStyle", () => {
  test("produces deterministic output in the given property order, skipping nullish values", () => {
    const css = serializeInlineStyle([
      ["color", "#333333"],
      ["font-size", null],
      ["padding-top", 8],
    ]);
    assert.equal(css, "color:#333333;padding-top:8;");
  });

  test("typographyStyleEntries produces a stable, escaped style string", () => {
    const css = serializeInlineStyle(
      typographyStyleEntries({
        fontFamily: "Georgia, serif",
        fontSizePx: 18,
        lineHeightPercent: 140,
        letterSpacingPx: 0.5,
        fontWeight: "bold",
        color: "#112233",
      }),
    );
    assert.equal(
      css,
      "font-family:Georgia, serif;font-size:18px;line-height:140%;letter-spacing:0.5px;font-weight:700;color:#112233;",
    );
  });

  test("rejects an invalid property name rather than silently passing it through", () => {
    assert.throws(() => serializeInlineStyle([["Font Size", "16px"]]));
  });
});
