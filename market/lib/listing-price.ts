export const PRICE_PROMOTION_DURATION_MS = 24 * 60 * 60 * 1000;

export function isReducedPrice(price: number, originalPrice: number | null | undefined) {
  return typeof originalPrice === "number" && originalPrice > price;
}

export function isRecentPriceReduction(
  price: number,
  originalPrice: number | null | undefined,
  priceReducedAt: string | null | undefined,
  nowMs: number,
) {
  if (!isReducedPrice(price, originalPrice) || !priceReducedAt) return false;
  const reducedAt = new Date(priceReducedAt).getTime();
  return Number.isFinite(reducedAt) && reducedAt <= nowMs && nowMs - reducedAt < PRICE_PROMOTION_DURATION_MS;
}

export function listingPriceUpdate(
  currentPrice: number,
  originalPrice: number | null,
  nextPrice: number,
  now: string,
) {
  if (nextPrice === currentPrice) {
    return { price: currentPrice, originalPrice, priceReducedAt: undefined };
  }
  if (nextPrice < currentPrice) {
    return {
      price: nextPrice,
      originalPrice: originalPrice !== null && originalPrice > currentPrice ? originalPrice : currentPrice,
      priceReducedAt: now,
    };
  }
  if (originalPrice !== null && nextPrice < originalPrice) {
    return { price: nextPrice, originalPrice, priceReducedAt: undefined };
  }
  return { price: nextPrice, originalPrice: null, priceReducedAt: null };
}
