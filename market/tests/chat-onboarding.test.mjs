import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");

test("first mobile contact offers optional PWA guidance", () => {
  assert.match(source, /chat-pwa-onboarding-seen/);
  assert.match(source, /!isStandalonePwa\(\)/);
  assert.match(source, /放到桌面后，更容易及时收到回复/);
  assert.match(source, /暂不安装，继续聊天/);
  assert.match(source, /查看安装方法/);
});

test("contact flow detects a missing push subscription after permission was granted", () => {
  assert.match(source, /pushManager\.getSubscription\(\)/);
  assert.match(source, /Notification\.permission === "granted" && !subscription/);
  assert.match(source, /开启通知并聊天/);
});

test("denied notification permission is explained without blocking chat", () => {
  assert.match(source, /Notification\.permission === "denied"/);
  assert.match(source, /chat-push-denied-explained/);
  assert.match(source, /知道了，继续聊天/);
  assert.match(source, /openChat\(listingId, true, true\)/);
});
