import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navSource = await readFile(new URL("../app/MobileNav.tsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/chat/unread/route.ts", import.meta.url), "utf8");

test("mobile navigation requests unread count without initializing the chat SDK", () => {
  assert.match(navSource, /fetch\("\/api\/chat\/unread"/);
  assert.doesNotMatch(navSource, /ensureCometChatSession|@cometchat/);
  assert.match(navSource, /visibilitychange/);
  assert.match(navSource, /60_000/);
});

test("message navigation badge includes the unread count and accessible label", () => {
  assert.match(navSource, /mobile-nav-unread/);
  assert.match(navSource, /unreadMessages > 99 \? "99\+"/);
  assert.match(navSource, /`消息，\$\{unreadMessages\} 条未读`/);
});

test("unread API counts only recipient events newer than the conversation read cursor", () => {
  assert.match(routeSource, /eq\(chatMessageEvents\.recipientEmail, member\.email\)/);
  assert.match(routeSource, /COALESCE\(\$\{chatConversationReads\.lastReadAt\}, 0\)/);
  assert.match(routeSource, /getMemberAccess/);
  assert.match(routeSource, /cache-control": "private, no-store"/);
});
