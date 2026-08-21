import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, moderationLog, users } from "../../../db/schema";
import { getAdminAccess } from "../../../lib/auth";

export async function PATCH(request: Request) {
  const admin = await getAdminAccess();
  if (!admin) return Response.json({ error: "没有管理员权限。" }, { status: 403 });

  const payload = (await request.json()) as {
    targetType?: "listing" | "user";
    targetId?: string;
    action?: string;
  };
  const db = await getDb();

  if (payload.targetType === "listing" && payload.targetId && ["active", "rejected", "sold"].includes(payload.action ?? "")) {
    await db
      .update(listings)
      .set({ status: payload.action!, updatedAt: new Date().toISOString() })
      .where(eq(listings.id, payload.targetId));
  } else if (payload.targetType === "user" && payload.targetId && ["verified", "rejected", "pending"].includes(payload.action ?? "")) {
    await db
      .update(users)
      .set({ academicStatus: payload.action! })
      .where(eq(users.email, payload.targetId));
  } else {
    return Response.json({ error: "无效的审核操作。" }, { status: 400 });
  }

  await db.insert(moderationLog).values({
    actorEmail: admin.email,
    targetType: payload.targetType,
    targetId: payload.targetId,
    action: payload.action!,
  });
  return Response.json({ ok: true });
}
