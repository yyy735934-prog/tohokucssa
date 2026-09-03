import assert from "node:assert/strict";
import test from "node:test";
import { listingPublicationStatus, deterministicListingRisk } from "../lib/listing-moderation.ts";

test("auto-publishes only verified low-risk batch items", () => {
  assert.equal(listingPublicationStatus({
    verifiedSeller: true,
    isAdmin: false,
    aiRisk: "low",
    title: "毕业出宜家书桌",
    description: "正常使用痕迹，请自取。",
  }), "active");
});
test("routes uncertain AI results and missing analyses to manual review", () => {
  for (const aiRisk of ["review", null]) {
    assert.equal(listingPublicationStatus({
      verifiedSeller: true,
      isAdmin: false,
      aiRisk,
      title: "普通闲置",
      description: "请买家现场确认状态。",
    }), "pending");
  }
});

test("server keywords override a low-risk AI answer", () => {
  for (const title of ["二手原付", "处方药转让", "品牌高仿包"]) {
    assert.equal(deterministicListingRisk(title, "状态请现场确认"), "review");
    assert.equal(listingPublicationStatus({
      verifiedSeller: true,
      isAdmin: false,
      aiRisk: "low",
      title,
      description: "状态请现场确认",
    }), "pending");
  }
});

test("never gives unverified members automatic publication", () => {
  assert.equal(listingPublicationStatus({
    verifiedSeller: false,
    isAdmin: false,
    aiRisk: "low",
    title: "二手键盘",
    description: "功能正常，现场确认。",
  }), "pending");
});

test("uses the same publication policy for ordinary single and batch listings", () => {
  assert.equal(listingPublicationStatus({
    verifiedSeller: true,
    isAdmin: false,
    aiRisk: "low",
    title: "家用剪刀",
    description: "普通文具剪刀，状态请现场确认。",
  }), "active");
});
