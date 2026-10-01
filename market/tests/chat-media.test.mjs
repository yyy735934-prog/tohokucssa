import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat composer only accepts supported images and async audio", async () => {
  const source = await readFile(new URL("../app/messages/[conversationId]/ChatMediaClient.tsx", import.meta.url), "utf8");
  assert.match(source, /image\/jpeg,image\/png,image\/webp/);
  assert.match(source, /MAX_IMAGE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source, /MAX_IMAGES_PER_PICK = 4/);
  assert.match(source, /MAX_RECORDING_SECONDS = 60/);
  assert.match(source, /MediaRecorder\.isTypeSupported/);
  assert.match(source, /onMediaMessageReceived/);
  assert.match(source, /sendMediaMessage/);
  assert.doesNotMatch(source, /MESSAGE_TYPE\.(?:VIDEO|FILE)/);
});

test("media messages have list previews and privacy-preserving push notices", async () => {
  const [list, webhook] = await Promise.all([
    readFile(new URL("../app/messages/MessagesClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/webhook/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(list, /type === "image"[\s\S]{0,80}\[图片\]/);
  assert.match(list, /type === "audio"[\s\S]{0,80}\[语音\]/);
  assert.match(webhook, /new Set\(\["text", "image", "audio"\]\)/);
  assert.match(webhook, /发来了一张图片/);
  assert.match(webhook, /发来了一条语音消息/);
  assert.doesNotMatch(webhook, /message\.(?:url|email|phone)/);
});

test("mobile chat keeps chrome fixed and only scrolls the message region", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.chat-page\{grid-template-rows:auto auto minmax\(0,1fr\)[^}]*overflow:hidden/);
  assert.match(css, /\.chat-messages\{min-height:0;overscroll-behavior:contain\}/);
  assert.match(css, /@media\(max-width:800px\)[\s\S]{0,180}\.chat-page\{position:fixed;inset:0/);
});
