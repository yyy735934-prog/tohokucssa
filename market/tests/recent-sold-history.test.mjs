import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { matchesMarketSearch } from "../lib/market-search.ts";

test("sold listings have a nullable timestamp and a legacy backfill migration", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0017_violet_praxagora.sql", import.meta.url), "utf8");
  assert.match(schema, /soldAt: text\("sold_at"\)/);
  assert.match(schema, /listings_status_sold_idx/);
  assert.match(migration, /ALTER TABLE `listings` ADD `sold_at` text/);
  assert.match(migration, /status` = 'sold'/);
  assert.match(migration, /sold_at` IS NULL/);
});

test("public APIs keep active listings separate from sold history", async () => {
  const publicApi = await readFile(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
  const historyApi = await readFile(new URL("../app/api/listings/history/route.ts", import.meta.url), "utf8");
  assert.match(publicApi, /eq\(listings\.status, "active"\)/);
  assert.match(publicApi, /eq\(listings\.status, "sold"\)/);
  assert.match(publicApi, /recentlySold/);
  assert.match(publicApi, /soldCount/);
  assert.match(historyApi, /eq\(listings\.status, "sold"\)/);
  assert.match(historyApi, /slice\(0, 24\)/);
  assert.doesNotMatch(historyApi, /ownerEmail:/);
});

test("sold history uses the same synonym search rules", () => {
  const soldBike = { title: "Bridgestone 通学自行车", category: "车辆与出行", place: "川内", note: "适合通勤" };
  assert.equal(matchesMarketSearch(soldBike, "bike"), true);
  assert.equal(matchesMarketSearch(soldBike, "单车"), true);
});

test("marking sold records soldAt while withdrawing clears it", async () => {
  const source = await readFile(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
  assert.match(source, /soldAt: payload\.status === "sold" \? now : null/);
  assert.match(source, /updatedAt: now/);
});
