import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, moderationLog, users } from "../../../db/schema";
import {
  isListingModerationAction,
  isUserModerationAction,
} from "../../../lib/admin-moderation";
import { getAdminAccess } from "../../../lib/auth";

export async function PATCH(request: Request) {
  const admin = await getAdminAccess();
  if (!admin) return Response.json({ error: "没有管理员权限。" }, { status: 403 });

  const payload = (await request.json()) as {
    targetType?: "listing" | "user" | "batch";
    targetId?: string;
    action?: string;
  };
  const db = await getDb();
  let updated = false;

  if (
    payload.targetType === "listing" &&
    payload.targetId &&
    isListingModerationAction(payload.action)
  ) {
    const rows = await db
      .update(listings)
      .set({ status: payload.action!, updatedAt: new Date().toISOString() })
      .where(eq(listings.id, payload.targetId))
      .returning({ id: listings.id });
    updated = Boolean(rows[0]);
  } else if (
    payload.targetType === "batch" &&
    payload.targetId &&
    payload.action === "active"
  ) {
    const rows = await db
      .update(listings)
      .set({ status: "active", updatedAt: new Date().toISOString() })
      .where(and(eq(listings.batchId, payload.targetId), eq(listings.status, "pending")))
      .returning({ id: listings.id });
    updated = rows.length > 0;
  } else if (
    payload.targetType === "user" &&
    payload.targetId &&
    isUserModerationAction(payload.action)
  ) {
    const target = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, payload.targetId))
      .limit(1);
    if (target[0]?.role === "admin") {
      return Response.json({ error: "不能修改管理员认证状态。" }, { status: 400 });
    }
    const rows = await db
      .update(users)
      .set({ academicStatus: payload.action! })
      .where(eq(users.email, payload.targetId))
      .returning({ email: users.email });
    updated = Boolean(rows[0]);
  } else {
    return Response.json({ error: "无效的审核操作。" }, { status: 400 });
  }

  if (!updated) {
    return Response.json({ error: "未找到审核对象。" }, { status: 404 });
  }

  await db.insert(moderationLog).values({
    actorEmail: admin.email,
    targetType: payload.targetType,
    targetId: payload.targetId,
    action: payload.action!,
  });
  return Response.json({ ok: true });
}
