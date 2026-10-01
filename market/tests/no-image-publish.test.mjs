import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("single listing publisher offers a real no-image path without demo data", async () => {
  const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");
  assert.match(source, />我不想上传图片</);
  assert.match(source, /onClick=\{continueWithoutPhoto\}/);
  assert.match(source, /photoName \|\| "未上传图片"/);
  assert.doesNotMatch(source, /使用示例照片体验/);
  assert.doesNotMatch(source, /复古植物装饰画/);
});
