import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { chatConversationReads, chatMessageEvents } from "../../../../db/schema";
import { getMemberAccess } from "../../../../lib/auth";
import { canUseMarketplace } from "../../../../lib/member-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ unread: 0 }, { status: 401 });
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json({ unread: 0 }, { status: 403 });
  }

  const db = await getDb();
  const [row] = await db
    .select({ unread: sql<number>`COUNT(*)` })
    .from(chatMessageEvents)
    .leftJoin(
      chatConversationReads,
      and(
        eq(chatConversationReads.conversationId, chatMessageEvents.conversationId),
        eq(chatConversationReads.userEmail, member.email),
      ),
    )
    .where(and(
      eq(chatMessageEvents.recipientEmail, member.email),
      sql`${chatMessageEvents.sentAt} > COALESCE(${chatConversationReads.lastReadAt}, 0)`,
    ));

  return Response.json(
    { unread: Math.max(0, Number(row?.unread ?? 0)) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
