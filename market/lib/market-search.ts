type SearchableListing = {
  title: string;
  category: string;
  place: string;
  note?: string;
};

const synonymGroups = [
  ["电饭锅", "电饭煲", "饭锅", "炊饭器", "ricecooker"],
  ["自行车", "单车", "脚踏车", "bike", "bicycle"],
  ["教材", "课本", "参考书", "教科书"],
  ["书籍", "图书", "书本"],
  ["除湿机", "抽湿机", "除湿器"],
  ["显示器", "显示屏", "屏幕", "monitor"],
  ["台灯", "桌灯", "书桌灯"],
  ["桌子", "书桌", "餐桌"],
  ["冰箱", "冷藏柜", "冷柜"],
  ["微波炉", "微波烤箱"],
  ["吹风机", "电吹风", "风筒"],
] as const;

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_/·,，.。:：;；'"“”‘’()（）]/g, "");
}

function expandedTerms(term: string) {
  const normalized = normalize(term);
  const matchingGroup = synonymGroups.find((group) =>
    group.some((alias) => normalize(alias) === normalized),
  );
  return matchingGroup
    ? matchingGroup.map((alias) => normalize(alias))
    : [normalized];
}

export function matchesMarketSearch(
  listing: SearchableListing,
  query: string,
) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalize(
    `${listing.title} ${listing.category} ${listing.place} ${listing.note ?? ""}`,
  );

  return terms.every((term) =>
    expandedTerms(term).some((candidate) => haystack.includes(candidate)),
  );
}
