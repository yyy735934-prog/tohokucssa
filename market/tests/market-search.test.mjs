import assert from "node:assert/strict";
import test from "node:test";
import { matchesMarketSearch } from "../lib/market-search.ts";

const riceCooker = {
  title: "象印 3 合电饭煲",
  category: "家电",
  place: "北仙台",
  note: "功能正常，适合一至两人使用。",
};

test("finds a listing through a Chinese synonym", () => {
  assert.equal(matchesMarketSearch(riceCooker, "电饭锅"), true);
});

test("normalizes spaces and matches across listing fields", () => {
  assert.equal(matchesMarketSearch(riceCooker, "  北仙台   电饭锅 "), true);
});

test("does not return an unrelated listing", () => {
  assert.equal(matchesMarketSearch(riceCooker, "自行车"), false);
});
