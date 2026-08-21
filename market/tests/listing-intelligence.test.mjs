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

test("uses the category default when only the description names a specific item", () => {
  assert.deepEqual(
    inferListingIntelligence("毕业出闲置", "电饭煲功能正常", "家电"),
    {
      category: "家电",
      icon: "🔌",
      tone: "cream",
    },
  );
});

test("keeps icon refinements inside the selected category", () => {
  assert.deepEqual(
    inferListingIntelligence("电脑桌", "适合放显示器和笔记本", "家具"),
    {
      category: "家具",
      icon: "🪵",
      tone: "sage",
    },
  );
});

test("ignores incidental description keywords when choosing a thumbnail", () => {
  assert.deepEqual(
    inferListingIntelligence("宜家收纳柜", "上层可以放电饭煲", "家具"),
    {
      category: "家具",
      icon: "🗄️",
      tone: "sage",
    },
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
