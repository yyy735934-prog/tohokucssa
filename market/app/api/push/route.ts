import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { pushSubscriptions } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";

type SubscriptionPayload = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const { env } = await import("cloudflare:workers");
  const publicKey = (env as unknown as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY;
  if (!publicKey) return Response.json({ error: "消息通知尚未配置。" }, { status: 503 });
  return Response.json({ publicKey });
}

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = (await request.json()) as SubscriptionPayload;
  if (!payload.endpoint?.startsWith("https://") || !payload.keys?.p256dh || !payload.keys.auth) {
    return Response.json({ error: "无效的消息订阅。" }, { status: 400 });
  }
  const db = await getDb();
  await db.insert(pushSubscriptions).values({
    endpoint: payload.endpoint,
    userEmail: member.email,
    p256dh: payload.keys.p256dh,
    auth: payload.keys.auth,
    userAgent: request.headers.get("user-agent"),
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: {
      userEmail: member.email,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      userAgent: request.headers.get("user-agent"),
      updatedAt: new Date().toISOString(),
    },
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const db = await getDb();
  if (payload.endpoint) {
    await db.delete(pushSubscriptions).where(and(
      eq(pushSubscriptions.endpoint, payload.endpoint),
      eq(pushSubscriptions.userEmail, member.email),
    ));
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userEmail, member.email));
  }
  return Response.json({ ok: true });
}
