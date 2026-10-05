import assert from "node:assert/strict";
import test from "node:test";
import { formatIssueMessage } from "./issue-messages.js";

test.describe("formatIssueMessage", () => {
  test("turns parser number bounds into friendly field messages", () => {
    assert.equal(
      formatIssueMessage({
        code: "value/number-too-small",
        message:
          'Value at "nodes.demo-divider.props.thicknessPx" must be >= 1.',
        path: "nodes.demo-divider.props.thicknessPx",
      }),
      "Thickness must be at least 1.",
    );
    assert.equal(
      formatIssueMessage(
        {
          code: "value/number-too-large",
          message: 'Value at "props.letterSpacingPx" must be <= 2.5.',
          path: "props.letterSpacingPx",
        },
        "Letter spacing (px)",
      ),
      "Letter spacing (px) must be at most 2.5.",
    );
  });

  test("removes internal data paths from fallback messages", () => {
    assert.equal(
      formatIssueMessage({
        code: "value/custom",
        message: 'Unsupported value at "nodes.heading-1.props.text".',
        path: "nodes.heading-1.props.text",
      }),
      "Unsupported value.",
    );
  });
});
