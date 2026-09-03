import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactRequests, listings, users } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import { canUseMarketplace } from "../../../lib/member-status";
import { sendMemberNotification } from "../../../lib/notification-email";
import { deliverAcceptedContactEmail, type ContactEmailEnv } from "../../../lib/contact-email-delivery";

type ContactStatus = "pending" | "accepted" | "declined";

function statusMessage(status: ContactStatus) {
  if (status === "accepted") return "卖家已接受申请，请在个人中心查看联系方式。";
  if (status === "declined") return "卖家已拒绝此前的联系申请。";
  return "联系申请已发送，正在等待卖家确认。";
}

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select({
      listingId: contactRequests.listingId,
      buyerEmail: contactRequests.buyerEmail,
      sellerEmail: contactRequests.sellerEmail,
      status: contactRequests.status,
    })
    .from(contactRequests)
    .where(
      or(
        eq(contactRequests.buyerEmail, member.email),
        eq(contactRequests.sellerEmail, member.email),
      ),
    );

  return Response.json({
    requests: rows
      .filter((contact) => contact.buyerEmail === member.email)
      .map((contact) => ({
        listingId: contact.listingId,
        status: contact.status,
      })),
    pendingIncoming: rows.filter(
      (contact) =>
        contact.sellerEmail === member.email && contact.status === "pending",
    ).length,
  });
}

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json({ error: "账号尚未获得使用权限，请先完成认证或申诉。" }, { status: 403 });
  }
  if (!member.profileCompleted) {
    return Response.json(
      {
        code: "CONTACT_PROFILE_REQUIRED",
        error: "请先填写至少一种联系方式，再向卖家发送申请。",
      },
      { status: 409 },
    );
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

  const existingRows = await db
    .select({ status: contactRequests.status })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.listingId, listing.id),
        eq(contactRequests.buyerEmail, member.email),
      ),
    )
    .limit(1);
  const existingStatus = existingRows[0]?.status as ContactStatus | undefined;
  if (existingStatus) {
    return Response.json({
      ok: true,
      contact: { listingId: listing.id, status: existingStatus },
      message: statusMessage(existingStatus),
    });
  }

  const created = await db
    .insert(contactRequests)
    .values({
      id: crypto.randomUUID(),
      listingId: listing.id,
      buyerEmail: member.email,
      buyerName: member.publicName,
      sellerEmail: listing.ownerEmail,
    })
    .onConflictDoNothing({
      target: [contactRequests.listingId, contactRequests.buyerEmail],
    }).returning({ id: contactRequests.id });

  if (created[0]) {
    await sendMemberNotification(
      listing.ownerEmail,
      "你收到一条新的商品联系申请",
      `${member.publicName} 希望联系你购买“${listing.title}”。请进入个人中心处理。`,
    );
  }

  return Response.json({
    ok: true,
    contact: { listingId: listing.id, status: "pending" },
    message: statusMessage("pending"),
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });

  const payload = (await request.json()) as { id?: string; status?: "accepted" | "declined" };
  if (!payload.id || !["accepted", "declined"].includes(payload.status ?? "")) {
    return Response.json({ error: "无效的操作。" }, { status: 400 });
  }

  const db = await getDb();
  if (payload.status === "accepted") {
    const sellerProfiles = await db
      .select({ profileCompleted: users.profileCompleted })
      .from(users)
      .where(eq(users.email, member.email))
      .limit(1);
    if (!sellerProfiles[0]?.profileCompleted) {
      return Response.json(
        {
          code: "CONTACT_PROFILE_REQUIRED",
          error: "请先完善至少一种联系方式，再接受买家的申请。",
        },
        { status: 409 },
      );
    }
  }
  const [updated] = await db
    .update(contactRequests)
    .set({ status: payload.status!, updatedAt: new Date().toISOString() })
    .where(and(
      eq(contactRequests.id, payload.id),
      eq(contactRequests.sellerEmail, member.email),
      eq(contactRequests.status, "pending"),
    ))
    .returning();

  if (updated) {
    const [listing] = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, updated.listingId)).limit(1);
    let emailDelivered = true;
    if (payload.status === "accepted") {
      const { env } = await import("cloudflare:workers");
      const delivery = await deliverAcceptedContactEmail(env as unknown as ContactEmailEnv, updated.id);
      emailDelivered = delivery.delivered;
    } else {
      await sendMemberNotification(
        updated.buyerEmail,
        "卖家已处理你的联系申请",
        `卖家未接受你对“${listing?.title ?? "商品"}”的联系申请。`,
      );
    }
    return Response.json({
        contact: { id: updated.id, status: updated.status },
        message: payload.status === "accepted"
          ? emailDelivered
            ? "已接受申请，联系方式已通过邮件通知买家。"
            : "已接受申请；邮件暂未送出，系统会自动重试，买家也可在个人中心查看联系方式。"
          : "已拒绝联系申请。",
        emailDelivered,
      });
  }
  return Response.json({ error: "未找到联系申请或没有操作权限。" }, { status: 404 });
}
