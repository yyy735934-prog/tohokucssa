import { buildPushPayload } from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { pushSubscriptions } from "../db/schema";

type PushEnv = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
};

export type PushNotification = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendWebPushNotification(userEmail: string, notification: PushNotification) {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as PushEnv;
  if (!runtimeEnv.VAPID_PUBLIC_KEY || !runtimeEnv.VAPID_PRIVATE_KEY) return;

  const db = await getDb();
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userEmail, userEmail))
    .limit(8);

  await Promise.allSettled(subscriptions.map(async (subscription) => {
    const request = await buildPushPayload(
      {
        data: JSON.stringify(notification),
        options: { ttl: 60 * 60 * 24 },
      },
      {
        endpoint: subscription.endpoint,
        expirationTime: null,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      {
        subject: "mailto:admin@tohokucssa.org",
        publicKey: runtimeEnv.VAPID_PUBLIC_KEY!,
        privateKey: runtimeEnv.VAPID_PRIVATE_KEY!,
      },
    );
    const response = await fetch(subscription.endpoint, request);
    if (response.status === 404 || response.status === 410) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    }
  }));
}
