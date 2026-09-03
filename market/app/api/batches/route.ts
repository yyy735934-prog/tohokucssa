import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { listingAnalyses, listingBatches, listings } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import { inferListingIntelligence } from "../../../lib/listing-intelligence";
import { listingPublicationStatus, type ListingRiskLevel } from "../../../lib/listing-moderation";
import { isOwnedListingImageKey } from "../../../lib/upload-ownership";
import { canUseMarketplace } from "../../../lib/member-status";

type BatchItemInput = {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  imageKey?: unknown;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录后再发布。" }, { status: 401 });
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json({ error: "账号尚未获得发布权限，请先完成认证或申诉。" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    title?: unknown;
    place?: unknown;
    lat?: unknown;
    lng?: unknown;
    items?: unknown;
  };
  const batchTitle = cleanText(payload.title, 60);
  const place = cleanText(payload.place, 80);
  const latitude =
    typeof payload.lat === "number" && payload.lat >= -90 && payload.lat <= 90
      ? Math.round(payload.lat * 1_000_000)
      : null;
  const longitude =
    typeof payload.lng === "number" && payload.lng >= -180 && payload.lng <= 180
      ? Math.round(payload.lng * 1_000_000)
      : null;
  const rawItems = Array.isArray(payload.items) ? (payload.items as BatchItemInput[]) : [];

  if (batchTitle.length < 2 || !place || latitude === null || longitude === null) {
    return Response.json({ error: "请填写批次名称，并在地图上标记统一交接地点。" }, { status: 400 });
  }
  if (rawItems.length < 1 || rawItems.length > 9) {
    return Response.json({ error: "每批请选择 1 至 9 件商品。" }, { status: 400 });
  }

  const normalized = rawItems.map((item) => ({
    title: cleanText(item.title, 80),
    description: cleanText(item.description, 800),
    price:
      typeof item.price === "number" && Number.isFinite(item.price)
        ? Math.max(0, Math.round(item.price))
        : -1,
    imageKey: cleanText(item.imageKey, 240),
  }));
  if (normalized.some((item) => item.title.length < 2 || item.description.length < 5 || item.price < 0 || !item.imageKey)) {
    return Response.json({ error: "请完整填写每件商品的名称、描述和价格。" }, { status: 400 });
  }
  const ownershipChecks = await Promise.all(
    normalized.map((item) => isOwnedListingImageKey(member.email, item.imageKey)),
  );
  if (ownershipChecks.some((owned) => !owned)) {
    return Response.json({ error: "商品照片无效，请重新上传。" }, { status: 400 });
  }

  const db = await getDb();
  const imageKeys = normalized.map((item) => item.imageKey);
  const analyses = await db
    .select()
    .from(listingAnalyses)
    .where(and(eq(listingAnalyses.ownerEmail, member.email), inArray(listingAnalyses.imageKey, imageKeys)));
  const analysisByKey = new Map(analyses.map((analysis) => [analysis.imageKey, analysis]));

  const batchId = crypto.randomUUID();
  const publicId = crypto.randomUUID().replaceAll("-", "").slice(0, 14);
  const prepared = normalized.map((item, index) => {
    const analysis = analysisByKey.get(item.imageKey);
    const visual = inferListingIntelligence(item.title, item.description, analysis?.category);
    const aiRisk: ListingRiskLevel | null = analysis?.riskLevel === "low" ? "low" : analysis ? "review" : null;
    return {
      id: crypto.randomUUID(),
      ownerEmail: member.email,
      ownerName: member.publicName,
      title: item.title,
      description: item.description,
      price: item.price,
      category: visual.category,
      place,
      latitude,
      longitude,
      status: listingPublicationStatus({
        verifiedSeller: member.academicStatus === "verified",
        isAdmin: member.isAdmin,
        aiRisk,
        title: item.title,
        description: item.description,
      }),
      icon: visual.icon,
      tone: visual.tone,
      imageKey: item.imageKey,
      batchId,
      batchPosition: index,
    };
  });

  await db.insert(listingBatches).values({
    id: batchId,
    publicId,
    ownerEmail: member.email,
    title: batchTitle,
    place,
    latitude,
    longitude,
  });
  await db.insert(listings).values(prepared);

  const activeCount = prepared.filter((item) => item.status === "active").length;
  return Response.json(
    {
      batch: { id: batchId, publicId, url: `/b/${publicId}` },
      activeCount,
      pendingCount: prepared.length - activeCount,
      message:
        activeCount === prepared.length
          ? "全部商品已自动发布。"
          : activeCount
            ? "普通商品已发布，其余商品进入人工审核。"
            : "已提交审核，预览海报现在即可下载转发。",
    },
    { status: 201 },
  );
}
