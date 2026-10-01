import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminReviewReminder } from "../lib/admin-reminder.ts";

test("does not email admins when all review queues are empty", () => {
  assert.equal(buildAdminReviewReminder({ listings: 0, appeals: 0 }), null);
});

test("summarizes pending listings and student appeals", () => {
  const reminder = buildAdminReviewReminder({ listings: 3, appeals: 2 });
  assert.match(reminder.subject, /5 项待审核/);
  assert.match(reminder.text, /待审核商品：3 件/);
  assert.match(reminder.text, /学生身份申诉：2 件/);
});
