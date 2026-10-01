import assert from "node:assert/strict";
import test from "node:test";
import { buildUnreadReminder, unreadReminderWindow } from "../lib/chat-unread-reminder.ts";

test("checks exactly the 24 hours ending at the scheduled 08:00 JST run", () => {
  const scheduledTime = Date.parse("2026-09-05T23:00:00.000Z");
  const window = unreadReminderWindow(scheduledTime);
  assert.equal(window.windowEnd - window.windowStart, 24 * 60 * 60);
  assert.equal(new Date(window.windowEnd * 1000).toISOString(), "2026-09-05T23:00:00.000Z");
});

test("normalizes retry invocations to the same 08:00 JST reminder window", () => {
  const first = unreadReminderWindow(Date.parse("2026-09-05T23:00:00.000Z"));
  const retry = unreadReminderWindow(Date.parse("2026-09-05T23:45:00.000Z"));
  assert.deepEqual(retry, first);
});

test("reminder reports only the unread count and inbox link", () => {
  const reminder = buildUnreadReminder(3);
  assert.match(reminder.subject, /3 条未读交易消息/);
  assert.match(reminder.text, /market\.tohokucssa\.org\/messages/);
  assert.doesNotMatch(reminder.text, /聊天正文/);
});
