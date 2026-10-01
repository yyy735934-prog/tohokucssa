import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { favorites, listings } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import { listingToMarketItem } from "../../../lib/listings";

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select({ listing: listings }).from(favorites)
    .innerJoin(listings, eq(favorites.listingId, listings.id))
    .where(and(eq(favorites.userEmail, member.email), eq(listings.status, "active")))
    .orderBy(desc(favorites.createdAt)).limit(100);
  return Response.json({ listings: rows.map((row) => listingToMarketItem(row.listing)) });
}

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录后收藏。" }, { status: 401 });
  const payload = (await request.json()) as { listingId?: string };
  if (!payload.listingId) return Response.json({ error: "缺少商品信息。" }, { status: 400 });
  const db = await getDb();
  const active = await db.select({ id: listings.id }).from(listings)
    .where(and(eq(listings.id, payload.listingId), eq(listings.status, "active"))).limit(1);
  if (!active.length) return Response.json({ error: "商品已下架。" }, { status: 404 });
  await db.insert(favorites).values({ userEmail: member.email, listingId: payload.listingId })
    .onConflictDoNothing({ target: [favorites.userEmail, favorites.listingId] });
  return Response.json({ saved: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const listingId = new URL(request.url).searchParams.get("listingId") ?? "";
  const db = await getDb();
  await db.delete(favorites).where(and(eq(favorites.userEmail, member.email), eq(favorites.listingId, listingId)));
  return Response.json({ saved: false });
}
