import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { verificationAppeals } from "../../../../db/schema";
import { getMemberAccess } from "../../../../lib/auth";

export async function GET(request: Request) {
  const member = await getMemberAccess();
  if (!member) return new Response("Unauthorized", { status: 401 });
  const appealId = new URL(request.url).searchParams.get("appeal")?.trim() ?? "";
  if (!appealId) return new Response("Invalid appeal", { status: 400 });
  const db = await getDb();
  const [appeal] = await db.select({ owner: verificationAppeals.userEmail, key: verificationAppeals.imageKey }).from(verificationAppeals).where(eq(verificationAppeals.id, appealId)).limit(1);
  if (!appeal || (!member.isAdmin && appeal.owner !== member.email)) return new Response("Forbidden", { status: 403 });
  if (!appeal.key?.startsWith("verification/")) return new Response("Not found", { status: 404 });
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
  const object = await runtimeEnv.BUCKET.get(appeal.key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'");
  return new Response(object.body, { headers });
}

