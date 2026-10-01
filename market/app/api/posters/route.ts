import { inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { listingPosterItems, listingPosters, listings } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import { isSameOriginRequest } from "../../../lib/email-auth";
import { canUseMarketplace } from "../../../lib/member-status";

function cleanTitle(value: unknown, fallback: string) {
  const title = typeof value === "string" ? value.trim().slice(0, 60) : "";
  return title.length >= 2 ? title : fallback;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });

  const payload = await request.json().catch(() => null) as {
    listingIds?: unknown;
    title?: unknown;
    scope?: unknown;
  } | null;
  const listingIds = Array.isArray(payload?.listingIds)
    ? Array.from(new Set(payload.listingIds.filter((id): id is string => typeof id === "string" && id.length > 0))).slice(0, 10)
    : [];
  if (listingIds.length < 2 || listingIds.length > 9) {
    return Response.json({ error: "请选择 2 至 9 件展示中的商品。" }, { status: 400 });
  }

  const isAdminPoster = payload?.scope === "admin";
  if (isAdminPoster && !member.isAdmin) return Response.json({ error: "没有管理员权限。" }, { status: 403 });
  if (!isAdminPoster && !canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json({ error: "账号尚未获得发布权限。" }, { status: 403 });
  }

  const db = await getDb();
  const rows = await db.select({ id: listings.id, ownerEmail: listings.ownerEmail, status: listings.status })
    .from(listings).where(inArray(listings.id, listingIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = listingIds.map((id) => byId.get(id));
  if (ordered.some((row) => !row || row.status !== "active")) {
    return Response.json({ error: "海报只能包含当前展示中的商品。" }, { status: 400 });
  }
  if (!isAdminPoster && ordered.some((row) => row!.ownerEmail !== member.email)) {
    return Response.json({ error: "只能选择自己发布的商品。" }, { status: 403 });
  }

  const posterId = crypto.randomUUID();
  const publicId = crypto.randomUUID().replaceAll("-", "").slice(0, 14);
  const title = cleanTitle(payload?.title, isAdminPoster ? "东北集市 · 本周精选" : "我的闲置合集");
  await db.insert(listingPosters).values({
    id: posterId,
    publicId,
    creatorEmail: member.email,
    kind: isAdminPoster ? "admin" : "seller",
    title,
  });
  await db.insert(listingPosterItems).values(listingIds.map((listingId, position) => ({ posterId, listingId, position })));
  return Response.json({ poster: { id: posterId, publicId, url: `/p/${publicId}` } }, { status: 201 });
}
