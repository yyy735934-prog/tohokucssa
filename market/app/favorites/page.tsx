import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { favorites, listings } from "../../db/schema";
import { requireMemberAccess } from "../../lib/auth";
import { listingToMarketItem } from "../../lib/listings";
import FavoritesClient from "./FavoritesClient";
import MyMarketNav from "../MyMarketNav";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const member = await requireMemberAccess("/favorites");
  const db = await getDb();
  const rows = await db.select({ listing: listings }).from(favorites)
    .innerJoin(listings, eq(favorites.listingId, listings.id))
    .where(and(eq(favorites.userEmail, member.email), eq(listings.status, "active")))
    .orderBy(desc(favorites.createdAt)).limit(100);
  return (
    <main className="portal-page favorites-page">
      <header className="portal-header">
        <Link className="brand" href="/"><span className="brand-mark">东</span><span><b>东北集市</b><small>我的收藏</small></span></Link>
        <nav><Link href="/map">附近闲置</Link><Link href="/account">个人中心</Link></nav>
      </header>
      <MyMarketNav active="favorites" />
      <FavoritesClient initialItems={rows.map((row) => listingToMarketItem(row.listing))} />
    </main>
  );
}
