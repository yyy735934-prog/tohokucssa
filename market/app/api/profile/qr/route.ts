import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { contactRequests, users } from "../../../../db/schema";
import { getMemberAccess } from "../../../../lib/auth";

export async function GET(request: Request) {
  const member = await getMemberAccess();
  if (!member) return new Response("Unauthorized", { status: 401 });
  const targetEmail = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!targetEmail) return new Response("Missing email", { status: 400 });
  if (targetEmail !== member.email.toLowerCase() && !member.isAdmin) {
    const db = await getDb();
    const shared = await db.select({ id: contactRequests.id }).from(contactRequests).where(
      and(eq(contactRequests.status, "accepted"), or(
        and(eq(contactRequests.buyerEmail, member.email), eq(contactRequests.sellerEmail, targetEmail)),
        and(eq(contactRequests.sellerEmail, member.email), eq(contactRequests.buyerEmail, targetEmail)),
      )),
    ).limit(1);
    if (!shared.length) return new Response("Forbidden", { status: 403 });
  }
  const db = await getDb();
  const [profile] = await db.select({ key: users.wechatQrKey }).from(users).where(eq(users.email, targetEmail)).limit(1);
  if (!profile?.key?.startsWith("profiles/")) return new Response("Not found", { status: 404 });
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
  const object = await runtimeEnv.BUCKET.get(profile.key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
