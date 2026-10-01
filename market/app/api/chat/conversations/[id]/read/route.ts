import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { chatConversationReads, chatConversations } from "../../../../../../db/schema";
import { requireMemberAccess } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const member = await requireMemberAccess(`/messages/${encodeURIComponent(id)}`);
  const db = await getDb();
  const [conversation] = await db.select({ id: chatConversations.id }).from(chatConversations).where(and(
    eq(chatConversations.id, id),
    or(eq(chatConversations.buyerEmail, member.email), eq(chatConversations.sellerEmail, member.email)),
  )).limit(1);
  if (!conversation) return Response.json({ error: "会话不存在或无权访问。" }, { status: 404 });

  const body = await request.json().catch(() => null) as { lastReadAt?: number } | null;
  const now = Math.floor(Date.now() / 1000);
  const requested = Math.trunc(Number(body?.lastReadAt));
  const lastReadAt = Number.isFinite(requested) ? Math.max(0, Math.min(requested, now)) : now;
  const readId = `${conversation.id}:${member.email}`;
  await db.insert(chatConversationReads).values({ id: readId, conversationId: conversation.id, userEmail: member.email, lastReadAt })
    .onConflictDoUpdate({
      target: chatConversationReads.id,
      set: {
        lastReadAt: sql`MAX(${chatConversationReads.lastReadAt}, ${lastReadAt})`,
        updatedAt: new Date().toISOString(),
      },
    });
  return Response.json({ ok: true });
}
