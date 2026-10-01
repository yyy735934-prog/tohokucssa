import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { verificationAppeals } from "../../../../db/schema";
import { getMemberAccess } from "../../../../lib/auth";
import { isSameOriginRequest } from "../../../../lib/email-auth";
import { isOwnedVerificationImageKey } from "../../../../lib/upload-ownership";

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const db = await getDb();
  const [appeal] = await db.select({ id: verificationAppeals.id, status: verificationAppeals.status, note: verificationAppeals.note, createdAt: verificationAppeals.createdAt }).from(verificationAppeals).where(eq(verificationAppeals.userEmail, member.email)).orderBy(desc(verificationAppeals.createdAt)).limit(1);
  return Response.json({ appeal: appeal ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (member.academicStatus === "verified") return Response.json({ error: "你的学生身份已认证，无需申诉。" }, { status: 409 });
  const payload = await request.json().catch(() => null) as { imageKey?: unknown } | null;
  if (!(await isOwnedVerificationImageKey(member.email, payload?.imageKey))) return Response.json({ error: "学生证照片无效，请重新上传。" }, { status: 400 });
  const db = await getDb();
  const [pending] = await db.select({ id: verificationAppeals.id }).from(verificationAppeals).where(and(eq(verificationAppeals.userEmail, member.email), eq(verificationAppeals.status, "pending"))).limit(1);
  if (pending) return Response.json({ error: "你已有一份待审核申诉，请耐心等待。" }, { status: 409 });
  const [created] = await db.insert(verificationAppeals).values({ id: crypto.randomUUID(), userEmail: member.email, imageKey: payload!.imageKey as string }).returning({ id: verificationAppeals.id, status: verificationAppeals.status, createdAt: verificationAppeals.createdAt });
  return Response.json({ appeal: created, message: "学生身份申诉已提交。" }, { status: 201 });
}

