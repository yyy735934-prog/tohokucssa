import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships an installable manifest with required icon sizes", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("service worker does not cache pages or API responses", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /pathname\.startsWith\("\/assets\/"\)/);
  assert.doesNotMatch(source, /caches\.match\(request\).*navigate/s);
});

test("service worker displays push messages and opens their account destination", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /addEventListener\("push"/);
  assert.match(source, /showNotification/);
  assert.match(source, /addEventListener\("notificationclick"/);
  assert.match(source, /openWindow\(targetUrl\)/);
});
