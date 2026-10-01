import assert from "node:assert/strict";
import test from "node:test";
import {
  isAppealModerationAction,
  isListingModerationAction,
  isUserModerationAction,
  shouldShowUserModerationActions,
} from "../lib/admin-moderation.ts";

test("allows administrators to withdraw marketplace listings", () => {
  assert.equal(isListingModerationAction("withdrawn"), true);
  assert.equal(isListingModerationAction("deleted"), false);
});

test("only shows academic review actions while a member is pending", () => {
  assert.equal(shouldShowUserModerationActions("member", "pending"), true);
  assert.equal(shouldShowUserModerationActions("member", "verified"), false);
  assert.equal(shouldShowUserModerationActions("member", "rejected"), false);
  assert.equal(shouldShowUserModerationActions("admin", "pending"), false);
});

test("supports ordinary-member approval and limited appeal decisions", () => {
  assert.equal(isUserModerationAction("member"), true);
  assert.equal(isAppealModerationAction("verified"), true);
  assert.equal(isAppealModerationAction("rejected"), true);
  assert.equal(isAppealModerationAction("member"), false);
});
