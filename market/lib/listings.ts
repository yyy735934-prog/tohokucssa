import type { listings } from "../db/schema";
import { listingCategoryLabel } from "./listing-intelligence";
import { ANONYMOUS_SELLER_NAME } from "./public-identity";

type ListingRow = typeof listings.$inferSelect;

export function listingToMarketItem(
  listing: ListingRow,
  viewerEmail?: string,
  sellerIdentity?: { name: string; verified: boolean },
) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    category: listingCategoryLabel(listing.category),
    place: listing.place,
    time: formatRelativeTime(listing.createdAt),
    seller: sellerIdentity?.name ?? ANONYMOUS_SELLER_NAME,
    sellerVerified: sellerIdentity?.verified ?? false,
    badge: listing.status === "active" ? "学友发布" : listing.status,
    icon: listing.icon,
    tone: listing.tone,
    note: listing.description,
    status: listing.status,
    isOwner: Boolean(viewerEmail && listing.ownerEmail === viewerEmail),
    createdAt: listing.createdAt,
    lat: listing.latitude === null ? null : listing.latitude / 1_000_000,
    lng: listing.longitude === null ? null : listing.longitude / 1_000_000,
    imageUrl: listing.imageKey
      ? `/api/images?key=${encodeURIComponent(listing.imageKey)}`
      : null,
  };
}

function formatRelativeTime(value: string) {
  const created = new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes}分钟前`;
  if (elapsedMinutes < 24 * 60) return `${Math.floor(elapsedMinutes / 60)}小时前`;
  return `${Math.floor(elapsedMinutes / (24 * 60))}天前`;
}
