import { and, eq, or } from "drizzle-orm";
import { requireMemberAccess } from "../../../../../lib/auth";
import { getDb } from "../../../../../db";
import { chatConversations, chatIdentities, listings } from "../../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const member = await requireMemberAccess(`/messages/${encodeURIComponent(id)}`);
  const db = await getDb();
  const rows = await db.select({ conversation: chatConversations, listing: listings })
    .from(chatConversations).innerJoin(listings, eq(chatConversations.listingId, listings.id))
    .where(and(eq(chatConversations.id, id), or(eq(chatConversations.buyerEmail, member.email), eq(chatConversations.sellerEmail, member.email)))).limit(1);
  const row = rows[0];
  if (!row) return Response.json({ error: "会话不存在或无权访问。" }, { status: 404 });
  const isBuyer = row.conversation.buyerEmail === member.email;
  let counterpart = "卖家";
  if (!isBuyer) {
    const [identity] = await db.select({ alias: chatIdentities.publicAlias }).from(chatIdentities).where(eq(chatIdentities.userEmail, row.conversation.buyerEmail)).limit(1);
    counterpart = `买家 ${identity?.alias ?? ""}`.trim();
  }
  return Response.json({
    id: row.conversation.id,
    providerGroupId: row.conversation.providerGroupId,
    counterpart,
    listing: { id: row.listing.id, title: row.listing.title, price: row.listing.price, status: row.listing.status, icon: row.listing.icon, imageUrl: row.listing.imageKey ? `/api/images?key=${encodeURIComponent(row.listing.imageKey)}` : null },
  });
}
