import test from "node:test";
import assert from "node:assert/strict";
import { isValidAdminAuthorization } from "../src/routes/admin-auth-core.js";

test("accepts a matching bearer token", () => {
  assert.equal(
    isValidAdminAuthorization("Bearer secret-token", "secret-token"),
    true
  );
});

test("rejects missing, malformed, or wrong bearer tokens", () => {
  assert.equal(isValidAdminAuthorization(undefined, "secret-token"), false);
  assert.equal(isValidAdminAuthorization("secret-token", "secret-token"), false);
  assert.equal(
    isValidAdminAuthorization("Bearer wrong-token", "secret-token"),
    false
  );
});

test("rejects when expected token is empty", () => {
  assert.equal(isValidAdminAuthorization("Bearer anything", ""), false);
});
