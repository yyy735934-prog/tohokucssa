import assert from "node:assert/strict";
import test from "node:test";
import { renderMarketEmail } from "../lib/email-template.ts";

test("renders the marketplace email style and escapes envelope text", () => {
  const html = renderMarketEmail({
    title: "通知 <测试>",
    subtitle: "请查看 & 确认",
    contentHtml: "<p>经过调用方转义的正文</p>",
    action: { href: "https://market.tohokucssa.org/account", label: "前往个人中心" },
    footer: "东北集市账号通知",
  });
  assert.match(html, /东北集市/);
  assert.match(html, /#17352d/);
  assert.match(html, /通知 &lt;测试&gt;/);
  assert.match(html, /请查看 &amp; 确认/);
  assert.match(html, /前往个人中心/);
  assert.doesNotMatch(html, /通知 <测试>/);
});
