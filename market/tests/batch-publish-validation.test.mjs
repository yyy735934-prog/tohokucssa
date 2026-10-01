import assert from "node:assert/strict";
import test from "node:test";
import { findBatchPublishValidationIssue } from "../lib/batch-publish-validation.ts";

const completeDraft = { id: "one", imageKey: "listings/one.jpg", title: "台灯", description: "可正常使用，含电源线。", price: "0", state: "ready" };
const base = { title: "毕业出清", place: "川内校园", location: { lat: 38.26, lng: 140.84 } };

test("batch validation guides the seller to the first missing item", () => {
  assert.deepEqual(findBatchPublishValidationIssue({ ...base, drafts: [] }), { key: "uploads", message: "请先添加至少一件商品。" });
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [{ ...completeDraft, state: "processing" }] })?.key, "draft-state");
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [{ ...completeDraft, price: "" }] })?.key, "draft-price");
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [completeDraft], location: null })?.key, "map");
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [completeDraft], place: "  " })?.key, "place");
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [completeDraft] }), null);
});

test("batch validation permits a manually completed item without an uploaded image", () => {
  assert.equal(findBatchPublishValidationIssue({ ...base, drafts: [{ ...completeDraft, imageKey: "" }] }), null);
});
