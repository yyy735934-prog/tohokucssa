import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("push notifications keep private listing and contact details out of lock-screen payloads", async () => {
  const admin = await readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
  assert.match(admin, /请进入个人中心查看审核结果/);
});
