import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, moderationLog, users, verificationAppeals } from "../../../db/schema";
import {
  isAppealModerationAction,
  isListingModerationAction,
  isUserModerationAction,
} from "../../../lib/admin-moderation";
import { getAdminAccess } from "../../../lib/auth";
import { sendWebPushNotification, type PushNotification } from "../../../lib/web-push";

export async function PATCH(request: Request) {
  const admin = await getAdminAccess();
  if (!admin) return Response.json({ error: "没有管理员权限。" }, { status: 403 });

  const payload = (await request.json()) as {
    targetType?: "listing" | "user" | "batch" | "appeal";
    targetId?: string;
    action?: string;
  };
  const db = await getDb();
  let updated = false;
  let notification: { email: string; message: PushNotification } | null = null;

  if (
    payload.targetType === "listing" &&
    payload.targetId &&
    isListingModerationAction(payload.action)
  ) {
    const [target] = await db.select({ ownerEmail: listings.ownerEmail }).from(listings).where(eq(listings.id, payload.targetId)).limit(1);
    const rows = await db
      .update(listings)
      .set({ status: payload.action!, updatedAt: new Date().toISOString() })
      .where(eq(listings.id, payload.targetId))
      .returning({ id: listings.id });
    updated = Boolean(rows[0]);
    if (updated && target) notification = {
      email: target.ownerEmail,
      message: { title: "商品审核状态已更新", body: "请进入个人中心查看审核结果。", url: "/account", tag: "listing-review" },
    };
  } else if (
    payload.targetType === "batch" &&
    payload.targetId &&
    payload.action === "active"
  ) {
    const [batchTarget] = await db.select({ ownerEmail: listings.ownerEmail }).from(listings).where(eq(listings.batchId, payload.targetId)).limit(1);
    const rows = await db
      .update(listings)
      .set({ status: "active", updatedAt: new Date().toISOString() })
      .where(and(eq(listings.batchId, payload.targetId), eq(listings.status, "pending")))
      .returning({ id: listings.id });
    updated = rows.length > 0;
    if (updated && batchTarget) notification = {
      email: batchTarget.ownerEmail,
      message: { title: "批量商品审核状态已更新", body: "请进入个人中心查看审核结果。", url: "/account", tag: "batch-review" },
    };
  } else if (
    payload.targetType === "appeal" &&
    payload.targetId &&
    isAppealModerationAction(payload.action)
  ) {
    const [appeal] = await db.select().from(verificationAppeals).where(and(eq(verificationAppeals.id, payload.targetId), eq(verificationAppeals.status, "pending"))).limit(1);
    if (!appeal) return Response.json({ error: "未找到待处理申诉。" }, { status: 404 });
    if (appeal.imageKey) {
      const { env } = await import("cloudflare:workers");
      const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
      try { await runtimeEnv.BUCKET.delete(appeal.imageKey); }
      catch { return Response.json({ error: "证明图片清理失败，请稍后重试。" }, { status: 502 }); }
    }
    const rows = await db.update(verificationAppeals).set({ status: payload.action!, imageKey: null, updatedAt: new Date().toISOString() }).where(and(eq(verificationAppeals.id, payload.targetId), eq(verificationAppeals.status, "pending"))).returning({ id: verificationAppeals.id });
    if (rows[0] && payload.action === "verified") {
      await db.update(users).set({ academicStatus: "verified" }).where(eq(users.email, appeal.userEmail));
    }
    updated = Boolean(rows[0]);
    if (updated) notification = {
      email: appeal.userEmail,
      message: { title: "学生身份申诉已处理", body: "请进入个人中心查看认证结果。", url: "/account", tag: "identity-review" },
    };
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
    if (updated) notification = {
      email: payload.targetId,
      message: { title: "账号审核状态已更新", body: "请进入个人中心查看认证结果。", url: "/account", tag: "identity-review" },
    };
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
  if (notification) await sendWebPushNotification(notification.email, notification.message);
  return Response.json({ ok: true });
}
