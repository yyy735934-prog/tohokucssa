import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("single listing sharing uses a canonical item route and server metadata", async () => {
  const [helper, page, home, batch, poster] = await Promise.all([
    readFile(new URL("../lib/listing-share.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/item/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/b/[publicId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/p/[publicId]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(helper, /\/item\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(helper, /免费/);
  assert.match(helper, /✓ 已找到新主人/);
  assert.match(page, /export async function generateMetadata/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /status === "rejected"/);
  assert.match(home, /<ShareButton compact/);
  assert.match(batch, /href=\{`\/item\//);
  assert.match(poster, /href=\{`\/item\//);
});

test("single listing share sheet generates an image poster with a QR code", async () => {
  const shareButton = await readFile(new URL("../app/item/[id]/ShareButton.tsx", import.meta.url), "utf8");
  assert.match(shareButton, /QRCode\.toDataURL\(listingShareUrl/);
  assert.match(shareButton, /1800 \/ renderedWidth/);
  assert.doesNotMatch(shareButton, /style: \{ width:/);
  assert.match(shareButton, /分享海报/);
  assert.match(shareButton, /下载海报/);
  assert.doesNotMatch(shareButton, /复制分享链接|复制微信群文案/);
});

test("poster export uses a fixed high-resolution canvas source", async () => {
  const poster = await readFile(new URL("../app/b/[publicId]/BatchPoster.tsx", import.meta.url), "utf8");
  assert.match(poster, /2400 \/ renderedWidth/);
  assert.doesNotMatch(poster, /style: \{ width:/);
  assert.match(poster, /document\.fonts\.ready/);
});

test("batch and curated poster pages expose social-card metadata and URL sharing", async () => {
  const [batchPage, posterPage, posterClient] = await Promise.all([
    readFile(new URL("../app/b/[publicId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/p/[publicId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/b/[publicId]/BatchPoster.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [batchPage, posterPage]) {
    assert.match(source, /openGraph:/);
    assert.match(source, /twitter:/);
    assert.match(source, /alternates:/);
    assert.match(source, /api\/images\?key=/);
  }
  assert.match(posterClient, /navigator\.share\(\{ url: window\.location\.href \}\)/);
  assert.match(posterClient, /分享网页卡片/);
});
