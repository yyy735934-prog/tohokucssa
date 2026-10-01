import assert from "node:assert/strict";
import test from "node:test";
import { toContactView } from "../lib/contact-view.ts";

const contact = {
  id: "contact-1",
  listingId: "listing-1",
  listingTitle: "二手书桌",
  buyerEmail: "buyer@example.com",
  buyerName: "买家同学",
  sellerEmail: "seller@example.com",
  sellerName: "卖家同学",
  status: "pending",
  createdAt: "2026-08-21T00:00:00.000Z",
  counterpartProfile: {
    phone: "090-0000-0000",
    wechat: "seller-wechat",
    qq: null,
    qrUrl: "/api/profile/qr?contact=contact-1",
  },
};

test("does not expose counterpart contact details before acceptance", () => {
  const view = toContactView(contact, contact.buyerEmail);
  assert.equal(view.direction, "outgoing");
  assert.equal(view.counterpartName, "卖家同学");
  assert.equal(view.counterpartContact, null);
  assert.equal("buyerEmail" in view, false);
  assert.equal("sellerEmail" in view, false);
  assert.equal("email" in (view.counterpartContact ?? {}), false);
});

test("shares counterpart details after the seller accepts", () => {
  const view = toContactView(
    { ...contact, status: "accepted" },
    contact.buyerEmail,
  );
  assert.deepEqual(view.counterpartContact, contact.counterpartProfile);
});

test("marks seller-side requests as incoming", () => {
  const view = toContactView(contact, contact.sellerEmail);
  assert.equal(view.direction, "incoming");
  assert.equal(view.counterpartName, "买家同学");
});
