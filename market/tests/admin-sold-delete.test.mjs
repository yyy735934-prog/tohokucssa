import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
const clientSource = await readFile(new URL("../app/admin/AdminClient.tsx", import.meta.url), "utf8");

test("admin delete endpoint is restricted to authenticated admins and sold listings", () => {
  assert.match(routeSource, /export async function DELETE/);
  assert.match(routeSource, /const admin = await getAdminAccess\(\)/);
  assert.match(routeSource, /eq\(listings\.status, "sold"\)/);
  assert.match(routeSource, /仅允许删除已售商品记录/);
});

test("admin delete clears listing foreign-key dependents before the listing", () => {
  const dependentTables = [
    "chatMessageEvents",
    "chatConversationReads",
    "chatConversations",
    "contactRequests",
    "favorites",
    "listingPosterItems",
  ];
  const listingDeleteIndex = routeSource.indexOf("db.delete(listings)");
  assert.ok(listingDeleteIndex > 0);
  for (const table of dependentTables) {
    const deleteIndex = routeSource.indexOf(`db.delete(${table})`);
    assert.ok(deleteIndex > 0 && deleteIndex < listingDeleteIndex, `${table} must be deleted first`);
  }
  assert.match(routeSource, /db\.batch\(\[/);
  assert.match(routeSource, /action: "deleted"/);
});

test("admin UI exposes a confirmed permanent delete action only for sold rows", () => {
  assert.match(clientSource, /if \(listing\.status !== "sold"\) return/);
  assert.match(clientSource, /window\.confirm/);
  assert.match(clientSource, /\{listing\.status === "sold" && \(/);
  assert.match(clientSource, /method: "DELETE"/);
  assert.match(clientSource, /永久删除/);
});
