import assert from "node:assert/strict";
import test from "node:test";
import {
  ANONYMOUS_SELLER_NAME,
  isValidPublicNickname,
  normalizePublicNickname,
  publicMemberName,
} from "../lib/public-identity.ts";

test("defaults every seller to an anonymous public identity", () => {
  assert.equal(publicMemberName(undefined, "Google Real Name"), ANONYMOUS_SELLER_NAME);
  assert.equal(publicMemberName("anonymous", "Google Real Name"), ANONYMOUS_SELLER_NAME);
});

test("uses only an explicitly selected valid nickname", () => {
  assert.equal(publicMemberName("nickname", "  仙台搬家人  "), "仙台搬家人");
  assert.equal(publicMemberName("nickname", "x"), ANONYMOUS_SELLER_NAME);
});

test("normalizes and validates public nicknames", () => {
  assert.equal(normalizePublicNickname("东北   学友"), "东北 学友");
  assert.equal(isValidPublicNickname("东北学友_07"), true);
  assert.equal(isValidPublicNickname("name@example.com"), false);
  assert.equal(isValidPublicNickname("<script>"), false);
});
