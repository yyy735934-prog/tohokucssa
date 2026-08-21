import assert from "node:assert/strict";
import test from "node:test";
import {
  inferListingIntelligence,
  LISTING_CATEGORIES,
} from "../lib/listing-intelligence.ts";

test("classifies and assigns a specific rice cooker icon", () => {
  assert.deepEqual(inferListingIntelligence("象印 3 合电饭煲"), {
    category: "家电",
    icon: "🍚",
    tone: "cream",
  });
});

test("classifies artwork and assigns a relevant map icon", () => {
  assert.deepEqual(inferListingIntelligence("木框复古植物装饰画"), {
    category: "艺术品",
    icon: "🖼️",
    tone: "lilac",
  });
});

test("uses title and description together for classification", () => {
  assert.equal(
    inferListingIntelligence("毕业出闲置", "27 寸通学自行车，附车锁").category,
    "交通",
  );
});

test("exposes every requested marketplace category", () => {
  assert.deepEqual(LISTING_CATEGORIES, [
    "家具",
    "家电",
    "交通",
    "书籍",
    "户外",
    "艺术品",
    "其他",
  ]);
});
