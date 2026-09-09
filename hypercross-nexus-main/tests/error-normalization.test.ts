import assert from "node:assert/strict";
import test from "node:test";

import { toErrorMessage } from "../src/lib/errors";

test("toErrorMessage returns the nested server message for structured errors", () => {
  assert.equal(
    toErrorMessage({ code: "INVALID_REQUEST", message: "A valid email is required." }, "Fallback message"),
    "A valid email is required."
  );
});

test("toErrorMessage keeps plain strings and falls back for empty values", () => {
  assert.equal(toErrorMessage("Plain error", "Fallback message"), "Plain error");
  assert.equal(toErrorMessage(null, "Fallback message"), "Fallback message");
  assert.equal(toErrorMessage({ code: "BAD_INPUT" }, "Fallback message"), "Fallback message");
});
