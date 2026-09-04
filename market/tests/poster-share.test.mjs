import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all public poster pages use the shared Web Share poster component", async () => {
  const [poster, batchPage, collectionPage] = await Promise.all([
    readFile(new URL("../app/b/[publicId]/BatchPoster.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/b/[publicId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/p/[publicId]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(batchPage, /<BatchPoster /);
  assert.match(collectionPage, /<BatchPoster /);
  assert.match(poster, /navigator\.share/);
  assert.match(poster, /navigator\.canShare\?\.\(\{ files: \[file\] \}\)/);
  assert.match(poster, /files: \[file\]/);
  assert.match(poster, /navigator\.clipboard\.writeText\(window\.location\.href\)/);
  assert.match(poster, /aria-label="分享或转发海报"/);
});
