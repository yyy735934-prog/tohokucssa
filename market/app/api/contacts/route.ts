import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactRequests, listings } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (member.academicStatus !== "verified" && !member.isAdmin) {
    return Response.json({ error: "完成学友身份认证后才能联系卖家。" }, { status: 403 });
  }

  const payload = (await request.json()) as { listingId?: string };
  if (!payload.listingId) return Response.json({ error: "缺少商品信息。" }, { status: 400 });

  const db = await getDb();
  const listingRows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, payload.listingId), eq(listings.status, "active")))
    .limit(1);
  const listing = listingRows[0];
  if (!listing) return Response.json({ error: "该商品已下架或不存在。" }, { status: 404 });
  if (listing.ownerEmail === "demo@tohoku-market.local") {
    return Response.json({ error: "这是平台示例商品，暂时无法联系卖家。" }, { status: 400 });
  }
  if (listing.ownerEmail === member.email) {
    return Response.json({ error: "不能向自己的商品发起联系申请。" }, { status: 400 });
  }

  await db
    .insert(contactRequests)
    .values({
      id: crypto.randomUUID(),
      listingId: listing.id,
      buyerEmail: member.email,
      buyerName: member.displayName,
      sellerEmail: listing.ownerEmail,
    })
    .onConflictDoNothing({
      target: [contactRequests.listingId, contactRequests.buyerEmail],
    });

  return Response.json({
    ok: true,
    message: "联系申请已发送。卖家接受后，双方可在个人中心查看联系方式。",
  });
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });

  const payload = (await request.json()) as { id?: string; status?: "accepted" | "declined" };
  if (!payload.id || !["accepted", "declined"].includes(payload.status ?? "")) {
    return Response.json({ error: "无效的操作。" }, { status: 400 });
  }

  const db = await getDb();
  const [updated] = await db
    .update(contactRequests)
    .set({ status: payload.status!, updatedAt: new Date().toISOString() })
    .where(and(eq(contactRequests.id, payload.id), eq(contactRequests.sellerEmail, member.email)))
    .returning();

  return updated
    ? Response.json({ contact: updated })
    : Response.json({ error: "未找到联系申请或没有操作权限。" }, { status: 404 });
}
