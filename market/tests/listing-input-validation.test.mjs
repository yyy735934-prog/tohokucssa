import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manual listings accept short meaningful text and report missing map coordinates separately", async () => {
  const source = await readFile(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /title\.length < 2/);
  assert.doesNotMatch(source, /description\.length < 5/);
  assert.match(source, /请填写商品标题/);
  assert.match(source, /请填写商品描述/);
  assert.match(source, /请在地图上点击并标记交接地点/);
});
