export const MARKET_ORIGIN = "https://market.tohokucssa.org";
export const DEFAULT_SHARE_IMAGE = `${MARKET_ORIGIN}/og.png`;

export type ShareListing = {
  id: string; title: string; price: number; description: string; place: string;
  category: string; status: string; imageKey?: string | null; imageUrl?: string | null; icon?: string;
};

export function listingShareUrl(id: string) {
  return `${MARKET_ORIGIN}/item/${encodeURIComponent(id)}`;
}

export function compactShareText(value: string, maxLength = 80) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

export function listingShareTitle(listing: ShareListing) {
  if (listing.status === "sold") return `${listing.title}｜✓ 已找到新主人｜东北集市`;
  if (listing.status === "pending") return `${listing.title}｜审核中｜东北集市`;
  if (listing.status === "withdrawn") return "商品已下架｜东北集市";
  return `${listing.title}｜${listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString("zh-CN")}`}｜东北集市`;
}

export function listingShareDescription(listing: ShareListing) {
  const summary = compactShareText(listing.description);
  const text = summary
    ? [summary, listing.place, "东北集市"].filter(Boolean).join(" · ")
    : [listing.category, listing.place, "东北集市学友会二手平台"].filter(Boolean).join(" · ");
  return listing.status === "sold" ? `${text} · ✓ 已找到新主人` : text;
}

export function listingShareImageUrl(listing: ShareListing) {
  return listing.imageKey ? `${MARKET_ORIGIN}/api/images?key=${encodeURIComponent(listing.imageKey)}` : DEFAULT_SHARE_IMAGE;
}

export function listingWechatText(listing: ShareListing) {
  if (listing.status === "sold") return `✓ ${listing.title} 已找到新主人\n\n东北集市还有更多闲置：\n${MARKET_ORIGIN}/`;
  const intro = listing.price === 0 ? `🎁 免费送：${listing.title}` : `📦 出一个：${listing.title}`;
  const price = listing.price === 0 ? "" : `\n💰 ¥${listing.price.toLocaleString("zh-CN")}`;
  const pending = listing.status === "pending" ? "\n⏳ 商品审核中" : "";
  const summary = compactShareText(listing.description, 60);
  return `${intro}${price}\n📍 ${listing.place}${pending}${summary ? `\n${summary}` : ""}\n\n详情和图片：\n${listingShareUrl(listing.id)}`;
}
