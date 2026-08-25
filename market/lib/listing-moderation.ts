export type ListingRiskLevel = "low" | "review";

const manualReviewPattern =
  /药品|处方药|保健药|香烟|烟草|电子烟|酒精|啤酒|白酒|成人用品|色情|刀具|武器|枪|证件|护照|在留卡|驾照|银行卡|盗版|仿品|高仿|假货|汽车|轿车|轻自动车|軽自動車|摩托|机车|原付|原动机付自行车/i;

export function deterministicListingRisk(title: string, description: string): ListingRiskLevel {
  return manualReviewPattern.test(`${title} ${description}`) ? "review" : "low";
}
export function batchListingStatus(input: {
  verifiedSeller: boolean;
  isAdmin: boolean;
  aiRisk: ListingRiskLevel | null;
  title: string;
  description: string;
}) {
  if (input.isAdmin) return "active" as const;
  if (!input.verifiedSeller) return "pending" as const;
  if (input.aiRisk !== "low") return "pending" as const;
  return deterministicListingRisk(input.title, input.description) === "low"
    ? ("active" as const)
    : ("pending" as const);
}
