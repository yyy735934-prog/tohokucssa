import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { listings, users } from "../../../../db/schema";
import { getMemberAccess } from "../../../../lib/auth";
import { listingToMarketItem } from "../../../../lib/listings";
import { matchesMarketSearch } from "../../../../lib/market-search";
import { publicMemberName } from "../../../../lib/public-identity";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ listings: [] });

  try {
    const member = await getMemberAccess();
    const db = await getDb();
    const candidates = await db
      .select()
      .from(listings)
      .where(eq(listings.status, "sold"))
      .orderBy(desc(sql`coalesce(${listings.soldAt}, ${listings.updatedAt})`))
      .limit(300);
    const matching = candidates
      .map((listing) => ({ listing, item: listingToMarketItem(listing, member?.email) }))
      .filter(({ item }) => matchesMarketSearch(item, query))
      .slice(0, 24);
    const ownerEmails = Array.from(new Set(matching.map(({ listing }) => listing.ownerEmail)));
    const sellerProfiles = ownerEmails.length
      ? await db.select({
          email: users.email,
          academicStatus: users.academicStatus,
          publicNameMode: users.publicNameMode,
          publicNickname: users.publicNickname,
        }).from(users).where(inArray(users.email, ownerEmails))
      : [];
    const sellerByEmail = new Map(sellerProfiles.map((profile) => [profile.email, {
      name: publicMemberName(profile.publicNameMode, profile.publicNickname),
      verified: profile.academicStatus === "verified",
    }]));
    return Response.json({
      listings: matching.map(({ listing }) => listingToMarketItem(listing, member?.email, sellerByEmail.get(listing.ownerEmail))),
    });
  } catch {
    return Response.json({ listings: [] }, { status: 503 });
  }
}
