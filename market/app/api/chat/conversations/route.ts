import { desc, eq, or } from "drizzle-orm";
import { requireMemberAccess } from "../../../../lib/auth";
import { canUseMarketplace } from "../../../../lib/member-status";
import { ensureListingConversation, getChatConfiguration } from "../../../../lib/cometchat-server";
import { getDb } from "../../../../db";
import { chatConversations, chatIdentities, listings } from "../../../../db/schema";

export const dynamic = "force-dynamic";

function listingSummary(row: typeof listings.$inferSelect) {
  return { id: row.id, title: row.title, price: row.price, status: row.status, icon: row.icon, imageUrl: row.imageKey ? `/api/images?key=${encodeURIComponent(row.imageKey)}` : null };
}

export async function GET() {
  const member = await requireMemberAccess("/messages");
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) return Response.json({ error: "暂无聊天权限。" }, { status: 403 });
  const db = await getDb();
  const rows = await db.select({ conversation: chatConversations, listing: listings })
    .from(chatConversations).innerJoin(listings, eq(chatConversations.listingId, listings.id))
    .where(or(eq(chatConversations.buyerEmail, member.email), eq(chatConversations.sellerEmail, member.email)))
    .orderBy(desc(chatConversations.updatedAt)).limit(100);
  const aliases = await db.select({ email: chatIdentities.userEmail, alias: chatIdentities.publicAlias }).from(chatIdentities);
  const aliasByEmail = new Map(aliases.map((row) => [row.email, row.alias]));
  return Response.json({ conversations: rows.map(({ conversation, listing }) => ({
    id: conversation.id,
    providerGroupId: conversation.providerGroupId,
    role: conversation.buyerEmail === member.email ? "buyer" : "seller",
    counterpart: conversation.buyerEmail === member.email ? "卖家" : `买家 ${aliasByEmail.get(conversation.buyerEmail) ?? ""}`.trim(),
    listing: listingSummary(listing),
    createdAt: conversation.createdAt,
  })) });
}

export async function POST(request: Request) {
  const member = await requireMemberAccess("/");
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) return Response.json({ error: "完成成员认证后即可联系卖家。" }, { status: 403 });
  const body = await request.json().catch(() => null) as { listingId?: unknown } | null;
  if (typeof body?.listingId !== "string" || body.listingId.length > 100) return Response.json({ error: "商品参数无效。" }, { status: 400 });
  const config = await getChatConfiguration();
  if (!config) return Response.json({ error: "聊天服务尚未完成配置。" }, { status: 503 });
  try {
    const conversation = await ensureListingConversation(body.listingId, member.email, config);
    return Response.json({ id: conversation.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SELF_CHAT") return Response.json({ error: "不能与自己发布的商品发起聊天。" }, { status: 400 });
    if (message === "LISTING_UNAVAILABLE") return Response.json({ error: "该商品当前不可发起新聊天。" }, { status: 409 });
    console.error("chat conversation failed", error);
    return Response.json({ error: "聊天服务暂时不可用，请稍后再试。" }, { status: 502 });
  }
}
