export type BatchDraftForValidation = {
  id: string;
  imageKey: string;
  title: string;
  description: string;
  price: string;
  state: "processing" | "ready";
};

export type BatchPublishValidationIssue = {
  key: "uploads" | "draft-state" | "draft-title" | "draft-description" | "draft-price" | "batch-title" | "map" | "place";
  message: string;
  draftId?: string;
};

type Location = { lat: number; lng: number } | null;

export function findBatchPublishValidationIssue({ drafts, title, place, location }: {
  drafts: BatchDraftForValidation[];
  title: string;
  place: string;
  location: Location;
}): BatchPublishValidationIssue | null {
  if (!drafts.length) return { key: "uploads", message: "请先添加至少一件商品。" };
  const processingIndex = drafts.findIndex((draft) => draft.state === "processing");
  if (processingIndex >= 0) return { key: "draft-state", draftId: drafts[processingIndex].id, message: `第 ${processingIndex + 1} 件商品仍在识别中，请等待识别完成。` };
  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    if (draft.title.trim().length < 2) return { key: "draft-title", draftId: draft.id, message: `第 ${number} 件商品名称过短，请至少填写 2 个字符。` };
    if (draft.description.trim().length < 5) return { key: "draft-description", draftId: draft.id, message: `第 ${number} 件商品描述过短，请至少填写 5 个字符。` };
    if (draft.price.trim() === "") return { key: "draft-price", draftId: draft.id, message: `第 ${number} 件商品尚未填写价格。` };
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) return { key: "draft-price", draftId: draft.id, message: `第 ${number} 件商品价格无效，请填写 0 或更大的金额。` };
  }
  if (title.trim().length < 2) return { key: "batch-title", message: "请填写至少 2 个字符的批次名称。" };
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) return { key: "map", message: "请选择统一交易地点的位置。" };
  if (!place.trim()) return { key: "place", message: "请填写地点名称，例如：仙台站东口／川内校园。" };
  return null;
}
