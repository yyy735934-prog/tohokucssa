import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, users } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import { inferListingIntelligence } from "../../../lib/listing-intelligence";
import { listingToMarketItem } from "../../../lib/listings";
import { publicMemberName } from "../../../lib/public-identity";

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table")
    ? "数据库正在初始化，请稍后刷新。"
    : "服务暂时不可用，请稍后再试。";
}

export async function GET() {
  try {
    const member = await getMemberAccess();
    const db = await getDb();
    const rows = await db
      .select()
      .from(listings)
      .where(eq(listings.status, "active"))
      .orderBy(desc(listings.createdAt))
      .limit(60);
    const ownerEmails = Array.from(new Set(rows.map((listing) => listing.ownerEmail)));
    const sellerProfiles = ownerEmails.length
      ? await db.select({
          email: users.email,
          academicStatus: users.academicStatus,
          publicNameMode: users.publicNameMode,
          publicNickname: users.publicNickname,
        }).from(users).where(inArray(users.email, ownerEmails))
      : [];
    const sellerByEmail = new Map(sellerProfiles.map((profile) => [profile.email, {
      name: publicMemberName(profile.publicNameMode, profile.publicNickname),
      verified: profile.academicStatus === "verified",
    }]));
    return Response.json({
      listings: rows.map((listing) =>
        listingToMarketItem(listing, member?.email, sellerByEmail.get(listing.ownerEmail)),
      ),
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) {
    return Response.json({ error: "请先登录后再发布。" }, { status: 401 });
  }
  if (member.academicStatus !== "verified" && !member.isAdmin) {
    return Response.json(
      { error: "学术邮箱尚未通过验证，请先在个人中心完成认证。" },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      price?: number;
      place?: string;
      lat?: number;
      lng?: number;
      imageKey?: string | null;
    };
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const place = payload.place?.trim() ?? "";
    const price = Number.isFinite(payload.price) ? Math.max(0, Math.round(payload.price!)) : 0;
    const latitude =
      Number.isFinite(payload.lat) && payload.lat! >= -90 && payload.lat! <= 90
        ? Math.round(payload.lat! * 1_000_000)
        : null;
    const longitude =
      Number.isFinite(payload.lng) && payload.lng! >= -180 && payload.lng! <= 180
        ? Math.round(payload.lng! * 1_000_000)
        : null;
    const imageKey =
      typeof payload.imageKey === "string" && payload.imageKey.startsWith("listings/")
        ? payload.imageKey.slice(0, 240)
        : null;

    if (
      title.length < 2 ||
      title.length > 80 ||
      description.length < 5 ||
      description.length > 800 ||
      !place ||
      latitude === null ||
      longitude === null
    ) {
      return Response.json({ error: "请完整填写标题、描述，并在地图上标记交接地点。" }, { status: 400 });
    }

    const visual = inferListingIntelligence(title, description);
    const status = member.isAdmin ? "active" : "pending";
    const db = await getDb();
    const [created] = await db
      .insert(listings)
      .values({
        id: crypto.randomUUID(),
        ownerEmail: member.email,
        ownerName: member.publicName,
        title,
        description,
        price,
        category: visual.category,
        place,
        latitude,
        longitude,
        status,
        icon: visual.icon,
        tone: visual.tone,
        imageKey,
      })
      .returning();

    return Response.json(
      {
        listing: listingToMarketItem(created, member.email, {
          name: member.publicName,
          verified: member.academicStatus === "verified",
        }),
        message: status === "active" ? "发布成功。" : "已提交审核，管理员通过后将公开展示。",
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });

  const payload = (await request.json()) as { id?: string; status?: string };
  if (!payload.id || !["sold", "withdrawn"].includes(payload.status ?? "")) {
    return Response.json({ error: "无效的操作。" }, { status: 400 });
  }

  const db = await getDb();
  const [updated] = await db
    .update(listings)
    .set({ status: payload.status, updatedAt: new Date().toISOString() })
    .where(and(eq(listings.id, payload.id), eq(listings.ownerEmail, member.email)))
    .returning();

  return updated
    ? Response.json({ listing: listingToMarketItem(updated) })
    : Response.json({ error: "未找到该商品或没有操作权限。" }, { status: 404 });
}
