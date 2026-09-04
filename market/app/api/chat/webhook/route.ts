import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { chatConversations, chatIdentities, chatPushEvents } from "../../../../db/schema";
import { sendWebPushNotification } from "../../../../lib/web-push";

type WebhookEnv = { COMETCHAT_APP_ID?: string; COMETCHAT_WEBHOOK_USERNAME?: string; COMETCHAT_WEBHOOK_PASSWORD?: string };
type MessagePayload = {
  trigger?: string;
  appId?: string;
  data?: { message?: { id?: string | number; sender?: string; receiver?: string; receiverType?: string; category?: string; type?: string } };
};

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  const config = env as unknown as WebhookEnv;
  if (!config.COMETCHAT_APP_ID || !config.COMETCHAT_WEBHOOK_USERNAME || !config.COMETCHAT_WEBHOOK_PASSWORD) return new Response("Not configured", { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  let supplied = "";
  try { supplied = atob(authorization.replace(/^Basic\s+/i, "")); } catch { /* invalid header */ }
  if (!safeEqual(supplied, `${config.COMETCHAT_WEBHOOK_USERNAME}:${config.COMETCHAT_WEBHOOK_PASSWORD}`)) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null) as MessagePayload | null;
  const message = body?.data?.message;
  if (body?.trigger !== "message_sent" || body.appId !== config.COMETCHAT_APP_ID || message?.receiverType !== "group" || message.category !== "message" || message.type !== "text" || !message.id || !message.receiver || !message.sender) return Response.json({ ok: true, ignored: true });

  const db = await getDb();
  const [conversation] = await db.select().from(chatConversations).where(eq(chatConversations.providerGroupId, message.receiver)).limit(1);
  if (!conversation) return Response.json({ ok: true, ignored: true });
  const identities = await db.select({ email: chatIdentities.userEmail, uid: chatIdentities.providerUid }).from(chatIdentities);
  const buyer = identities.find((identity) => identity.email === conversation.buyerEmail);
  const seller = identities.find((identity) => identity.email === conversation.sellerEmail);
  const recipient = message.sender === buyer?.uid ? conversation.sellerEmail : message.sender === seller?.uid ? conversation.buyerEmail : null;
  if (!recipient) return Response.json({ ok: true, ignored: true });

  const inserted = await db.insert(chatPushEvents).values({ providerMessageId: String(message.id) }).onConflictDoNothing().returning({ id: chatPushEvents.providerMessageId });
  if (!inserted[0]) return Response.json({ ok: true, duplicate: true });
  await sendWebPushNotification(recipient, {
    title: "东北集市 · 新消息",
    body: "你收到一条新的匿名交易消息。",
    url: `/messages/${conversation.id}`,
    tag: `chat-${conversation.id}`,
  });
  return Response.json({ ok: true });
}
