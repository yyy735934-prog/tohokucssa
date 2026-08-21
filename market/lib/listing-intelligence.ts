export const LISTING_CATEGORIES = [
  "家具",
  "家电",
  "交通",
  "书籍",
  "户外",
  "艺术品",
  "其他",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

type ListingVisual = {
  category: ListingCategory;
  icon: string;
  tone: string;
};

const categoryRules: Array<{
  category: ListingCategory;
  pattern: RegExp;
}> = [
  {
    category: "艺术品",
    pattern: /油画|水彩|版画|装饰画|挂画|绘画|书法|雕塑|陶艺|陶瓷|艺术品|工艺品|吉他|尤克里里|小提琴|乐器|古董|手办/,
  },
  {
    category: "交通",
    pattern: /自行车|单车|脚踏车|公路车|山地车|电动车|电动滑板|滑板车|摩托|头盔|车锁|车灯|汽车|轮胎/,
  },
  {
    category: "书籍",
    pattern: /教材|教科书|参考书|词典|字典|小说|漫画|杂志|书籍|图书|文献|习题|真题|n[1-5]\b|jlpt|toefl|ielts/,
  },
  {
    category: "户外",
    pattern: /帐篷|睡袋|露营|野餐|登山|徒步|户外|折叠椅|烧烤架|烤炉|羽毛球|网球|足球|篮球|滑雪|雪板|冲浪|钓鱼/,
  },
  {
    category: "家具",
    pattern: /桌|椅|沙发|床|床垫|衣柜|书柜|鞋柜|橱柜|置物架|收纳架|茶几|地毯|窗帘|镜子|家具/,
  },
  {
    category: "家电",
    pattern: /电饭|炊饭|冰箱|冷柜|微波炉|烤箱|洗衣机|吸尘器|除湿|加湿|空调|风扇|吹风|电吹风|台灯|电热水壶|咖啡机|电视|显示器|屏幕|电脑|笔记本|平板|手机|相机|音箱|耳机|路由器|打印机|家电/,
  },
];

const iconRules: Array<{ icon: string; pattern: RegExp }> = [
  { icon: "🍚", pattern: /电饭|炊饭/ },
  { icon: "🧊", pattern: /冰箱|冷柜|冷藏/ },
  { icon: "🧺", pattern: /洗衣机|烘干机/ },
  { icon: "🍞", pattern: /烤箱|面包机/ },
  { icon: "🥘", pattern: /微波炉/ },
  { icon: "💧", pattern: /除湿|加湿/ },
  { icon: "🌀", pattern: /风扇|空调/ },
  { icon: "💡", pattern: /灯|照明/ },
  { icon: "☕", pattern: /咖啡机|咖啡壶/ },
  { icon: "📺", pattern: /电视/ },
  { icon: "🖥️", pattern: /显示器|显示屏|屏幕|台式机/ },
  { icon: "💻", pattern: /笔记本|电脑|macbook/ },
  { icon: "📱", pattern: /手机|iphone|平板|ipad/ },
  { icon: "📷", pattern: /相机|摄影机|摄像机/ },
  { icon: "🎧", pattern: /耳机|音箱|扬声器/ },
  { icon: "🖨️", pattern: /打印机|扫描仪/ },
  { icon: "🛋️", pattern: /沙发/ },
  { icon: "🛏️", pattern: /床|床垫/ },
  { icon: "🪑", pattern: /椅|凳/ },
  { icon: "🗄️", pattern: /衣柜|书柜|鞋柜|橱柜|收纳柜/ },
  { icon: "🪞", pattern: /镜子|穿衣镜/ },
  { icon: "🪵", pattern: /桌|茶几|置物架|收纳架/ },
  { icon: "🚲", pattern: /自行车|单车|脚踏车|公路车|山地车/ },
  { icon: "🛵", pattern: /电动车|摩托|滑板车/ },
  { icon: "🛹", pattern: /滑板/ },
  { icon: "⛑️", pattern: /头盔/ },
  { icon: "📚", pattern: /教材|教科书|参考书|词典|字典|书籍|图书/ },
  { icon: "📖", pattern: /小说|漫画|杂志/ },
  { icon: "⛺", pattern: /帐篷|露营|睡袋/ },
  { icon: "🥾", pattern: /登山|徒步/ },
  { icon: "🏸", pattern: /羽毛球/ },
  { icon: "🎾", pattern: /网球/ },
  { icon: "⚽", pattern: /足球/ },
  { icon: "🏀", pattern: /篮球/ },
  { icon: "🏂", pattern: /滑雪|雪板/ },
  { icon: "🖼️", pattern: /油画|水彩|版画|装饰画|挂画|绘画|书法/ },
  { icon: "🏺", pattern: /陶艺|陶瓷|古董/ },
  { icon: "🗿", pattern: /雕塑/ },
  { icon: "🎸", pattern: /吉他|尤克里里/ },
  { icon: "🎻", pattern: /小提琴/ },
  { icon: "🎹", pattern: /钢琴|电子琴|键盘/ },
  { icon: "🧸", pattern: /手办|玩偶|公仔/ },
];

const categoryDefaults: Record<ListingCategory, { icon: string; tone: string }> = {
  家具: { icon: "🪑", tone: "sage" },
  家电: { icon: "🔌", tone: "cream" },
  交通: { icon: "🚲", tone: "blue" },
  书籍: { icon: "📚", tone: "lilac" },
  户外: { icon: "⛺", tone: "orange" },
  艺术品: { icon: "🖼️", tone: "lilac" },
  其他: { icon: "📦", tone: "aqua" },
};

export function isListingCategory(value: unknown): value is ListingCategory {
  return LISTING_CATEGORIES.includes(value as ListingCategory);
}

export function inferListingIntelligence(
  title: string,
  description = "",
  preferredCategory?: unknown,
): ListingVisual {
  const searchable = `${title} ${description}`.toLowerCase();
  const matchedCategory = categoryRules.find(({ pattern }) =>
    pattern.test(searchable),
  )?.category;
  const category = isListingCategory(preferredCategory)
    ? preferredCategory
    : matchedCategory ?? "其他";
  const fallback = categoryDefaults[category];
  const icon =
    iconRules.find(({ pattern }) => pattern.test(searchable))?.icon ??
    fallback.icon;

  return { category, icon, tone: fallback.tone };
}
