import assert from "node:assert/strict";
import test from "node:test";

import { resolveJwtSecret } from "../server/auth/ProductionAuthService";

test("resolveJwtSecret falls back to a development secret when JWT_SECRET is missing", () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const secret = resolveJwtSecret();
    assert.equal(typeof secret, "string");
    assert.ok(secret.length > 0);
  } finally {
    if (previous === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previous;
    }
  }
});
