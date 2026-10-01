import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketplace uses anonymous chat without mandatory transaction contacts", async () => {
  const [home, profile, account, nav, contactsApi, worker] = await Promise.all([
    readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ProfileSetup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/AccountClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MyMarketNav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contacts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(home, /\/api\/contacts|showProfileSetup|profileReady/);
  assert.doesNotMatch(profile, /phone|wechat|qq|二维码|至少填写/);
  assert.doesNotMatch(account, /initialContacts|respondToContact|shared-contact/);
  assert.doesNotMatch(nav, /account#contacts|account#profile-contact/);
  assert.match(contactsApi, /status: 410/);
  assert.doesNotMatch(worker, /retryAcceptedContactEmails/);
});
