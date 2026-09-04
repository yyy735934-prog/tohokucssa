import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("push notifications keep private listing and contact details out of lock-screen payloads", async () => {
  const [contacts, admin] = await Promise.all([
    readFile(new URL("../app/api/contacts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(contacts, /有买家提交了联络申请/);
  assert.doesNotMatch(contacts, /sendWebPushNotification[\s\S]{0,220}listing\.title/);
  assert.match(admin, /请进入个人中心查看审核结果/);
});
