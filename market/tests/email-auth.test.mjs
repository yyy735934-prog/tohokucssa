import assert from "node:assert/strict";
import test from "node:test";
import {
  constantTimeTextEqual,
  createEmailLoginCode,
  displayNameFromEmail,
  hashEmailLoginCode,
  isValidLoginEmail,
  normalizeLoginEmail,
} from "../lib/email-auth.ts";

test("normalizes and validates login email addresses", () => {
  assert.equal(normalizeLoginEmail("  Member@Tohoku.AC.JP "), "member@tohoku.ac.jp");
  assert.equal(isValidLoginEmail("member@tohoku.ac.jp"), true);
  assert.equal(isValidLoginEmail("invalid-address"), false);
});

test("generates a six digit email login code", () => {
  assert.match(createEmailLoginCode(), /^\d{6}$/);
});

test("hashes login codes without storing the plaintext code", async () => {
  const hash = await hashEmailLoginCode(
    "test-session-secret",
    "member@example.com",
    "123456",
  );
  assert.notEqual(hash, "123456");
  assert.equal(hash.length, 64);
  assert.equal(constantTimeTextEqual(hash, hash), true);
  const differentHash = `${hash[0] === "0" ? "1" : "0"}${hash.slice(1)}`;
  assert.equal(constantTimeTextEqual(hash, differentHash), false);
});

test("derives a readable default display name from an email", () => {
  assert.equal(displayNameFromEmail("ding.junzhong@example.com"), "ding junzhong");
});
