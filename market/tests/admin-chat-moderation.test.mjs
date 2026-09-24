import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminClient = await readFile(new URL("../app/admin/AdminClient.tsx", import.meta.url), "utf8");
const conversations = await readFile(new URL("../app/api/chat/conversations/route.ts", import.meta.url), "utf8");
const conversationDetail = await readFile(new URL("../app/api/chat/conversations/[id]/route.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../lib/cometchat-server.ts", import.meta.url), "utf8");
const chatClient = await readFile(new URL("../app/messages/[conversationId]/ChatMediaClient.tsx", import.meta.url), "utf8");

test("pending listing review exposes an administrator-only seller contact action", () => {
  assert.match(adminClient, /purpose:\s*"moderation"/);
  assert.match(adminClient, /listing\.status !== "pending"/);
  assert.match(conversations, /moderation && !member\.isAdmin/);
  assert.match(conversations, /仅管理员可发起商品审核核实/);
});

test("moderation conversations accept pending listings without changing normal buyer chat rules", () => {
  assert.match(server, /options\.moderation \? "pending" : "active"/);
  assert.match(server, /options\.moderation \? "商品审核核实" : "匿名交易会话"/);
  assert.match(server, /options\.moderation \? "review_" : ""/);
  assert.match(conversations, /ensureListingConversation\(body\.listingId, member\.email, config, \{ moderation \}\)/);
});

test("seller sees the platform administrator identity without receiving private account details", () => {
  assert.match(conversations, /"平台管理员"/);
  assert.match(conversationDetail, /conversation\.id\.startsWith\("review_"\)/);
  assert.match(conversationDetail, /counterpart = purpose === "moderation" \? "平台管理员"/);
  assert.doesNotMatch(conversationDetail, /buyerEmail:/);
});

test("moderation chat provides editable prompts and an admin return path", () => {
  assert.match(chatClient, /MODERATION_PROMPTS/);
  assert.match(chatClient, /setText\(prompt\)/);
  assert.match(chatClient, /info\.viewerIsAdmin \? "\/admin" : "\/account"/);
});
