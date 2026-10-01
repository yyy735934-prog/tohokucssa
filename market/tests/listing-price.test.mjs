import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isRecentPriceReduction,
  isReducedPrice,
  listingPriceUpdate,
  PRICE_PROMOTION_DURATION_MS,
} from "../lib/listing-price.ts";

const routeSource = await readFile(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
const accountSource = await readFile(new URL("../app/account/AccountClient.tsx", import.meta.url), "utf8");
const homeSource = await readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8");

test("first reduction preserves the previous price and starts a 24-hour promotion", () => {
  const now = "2026-09-07T12:00:00.000Z";
  assert.deepEqual(listingPriceUpdate(3000, null, 1800, now), {
    price: 1800,
    originalPrice: 3000,
    priceReducedAt: now,
  });
  assert.equal(isRecentPriceReduction(1800, 3000, now, Date.parse(now) + PRICE_PROMOTION_DURATION_MS - 1), true);
  assert.equal(isRecentPriceReduction(1800, 3000, now, Date.parse(now) + PRICE_PROMOTION_DURATION_MS), false);
});

test("further reductions retain the campaign original price and refresh promotion", () => {
  const result = listingPriceUpdate(1800, 3000, 1200, "2026-09-08T00:00:00.000Z");
  assert.equal(result.originalPrice, 3000);
  assert.equal(result.price, 1200);
  assert.equal(result.priceReducedAt, "2026-09-08T00:00:00.000Z");
});

test("raising back to the original price clears reduction presentation", () => {
  assert.deepEqual(listingPriceUpdate(1800, 3000, 3000, "2026-09-08T00:00:00.000Z"), {
    price: 3000,
    originalPrice: null,
    priceReducedAt: null,
  });
  assert.equal(isReducedPrice(3000, null), false);
});

test("partial price increase keeps original comparison without renewing promotion", () => {
  assert.deepEqual(listingPriceUpdate(1200, 3000, 1600, "2026-09-08T00:00:00.000Z"), {
    price: 1600,
    originalPrice: 3000,
    priceReducedAt: undefined,
  });
});

test("price changes are owner-scoped and limited to pending or active listings", () => {
  assert.match(routeSource, /eq\(listings\.ownerEmail, member\.email\)/);
  assert.match(routeSource, /inArray\(listings\.status, \["pending", "active"\]\)/);
  assert.match(routeSource, /Number\.isSafeInteger\(nextPrice\)/);
});

test("seller UI and homepage expose the reduction presentation and priority", () => {
  assert.match(accountSource, /改价格/);
  assert.match(accountSource, /首页优先展示 24 小时/);
  assert.match(homeSource, /price-drop-badge/);
  assert.match(homeSource, /isRecentPriceReduction/);
  assert.match(homeSource, /<del>/);
});
