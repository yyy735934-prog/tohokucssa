import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("switch account clears the session and returns to sign in", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("account-access", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/signout-with-chatgpt?switch=1&return_to=%2Faccount"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/signin-with-chatgpt?return_to=%2Faccount");
  assert.match(response.headers.get("set-cookie") ?? "", /^tohoku_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("includes both configured administrator emails", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const admins = config.vars.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase());
  assert.deepEqual(admins, ["ding.junzhong.p4@dc.tohoku.ac.jp", "hpwang1933@gmail.com"]);
});
