import assert from "node:assert/strict";
import test from "node:test";
import { canUseMarketplace, isStudentVerified } from "../lib/member-status.ts";

test("verified students and ordinary approved members can use the marketplace", () => {
  assert.equal(canUseMarketplace("verified"), true);
  assert.equal(canUseMarketplace("member"), true);
  assert.equal(canUseMarketplace("pending"), false);
  assert.equal(canUseMarketplace("rejected"), false);
  assert.equal(canUseMarketplace("pending", true), true);
});

test("only verified students receive the public verification badge", () => {
  assert.equal(isStudentVerified("verified"), true);
  assert.equal(isStudentVerified("member"), false);
});
