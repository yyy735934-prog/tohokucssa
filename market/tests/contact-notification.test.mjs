import assert from "node:assert/strict";
import test from "node:test";
import { acceptedContactEmailText } from "../lib/contact-notification.ts";

test("accepted contact email includes seller contact details", () => {
  const text = acceptedContactEmailText("二手行李箱", {
    phone: "090-0000-0000",
    wechat: "tohoku_friend",
    qq: null,
    hasWechatQr: true,
  });
  assert.match(text, /090-0000-0000/);
  assert.match(text, /tohoku_friend/);
  assert.match(text, /个人中心查看/);
  assert.match(text, /不要提前转账/);
});
