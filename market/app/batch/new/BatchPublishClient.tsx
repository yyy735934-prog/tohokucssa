"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import PublishLocationMap, { type PublishLocation } from "../../PublishLocationMap";
import { findBatchPublishValidationIssue } from "../../../lib/batch-publish-validation";

type BatchDraft = {
  id: string;
  file: File;
  preview: string;
  imageKey: string;
  title: string;
  description: string;
  price: string;
  riskLevel: "low" | "review";
  riskReason: string;
  state: "processing" | "ready";
};

async function readJson<T>(response: Response) {
  try { return (await response.json()) as T; } catch { return null; }
}

async function compressPhoto(file: File) {
  if (file.size <= 1_200_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("照片处理失败");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .76));
  if (!blob) throw new Error("照片处理失败");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "item"}.jpg`, { type: "image/jpeg" });
}

export default function BatchPublishClient({ sellerName, sellerVerified, children }: { sellerName: string; sellerVerified: boolean; children?: ReactNode }) {
  const [title, setTitle] = useState("毕业搬家·闲置出清");
  const [place, setPlace] = useState("");
  const [location, setLocation] = useState<PublishLocation | null>(null);
  const [drafts, setDrafts] = useState<BatchDraft[]>([]);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const batchTitleRef = useRef<HTMLInputElement>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const draftCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const draftInputRefs = useRef<Record<string, Partial<Record<"title" | "description" | "price", HTMLInputElement | HTMLTextAreaElement | null>>>>({});

  const update = (id: string, changes: Partial<BatchDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...changes } : draft));
  };

  const clearInvalidField = (key: string) => {
    setInvalidFields((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const processDraft = async (draft: BatchDraft) => {
    let uploadedKey = "";
    try {
      const file = await compressPhoto(draft.file);
      const uploadForm = new FormData();
      uploadForm.append("image", file);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: uploadForm });
      const upload = await readJson<{ key?: string; error?: string }>(uploadResponse);
      if (!uploadResponse.ok || !upload?.key) throw new Error(upload?.error || "照片上传失败");
      uploadedKey = upload.key;

      const aiForm = new FormData();
      aiForm.append("image", file);
      aiForm.append("imageKey", uploadedKey);
      const aiResponse = await fetch("/api/ai/listing", { method: "POST", body: aiForm });
      const ai = await readJson<{
        title?: string; description?: string; riskLevel?: "low" | "review"; riskReason?: string; error?: string;
      }>(aiResponse);
      if (!aiResponse.ok || !ai?.title || !ai.description) throw new Error(ai?.error || "AI 识别失败");
      update(draft.id, {
        imageKey: uploadedKey,
        title: ai.title,
        description: ai.description,
        riskLevel: ai.riskLevel === "low" ? "low" : "review",
        riskReason: ai.riskReason || "需要人工确认",
        state: "ready",
      });
    } catch {
      if (uploadedKey) {
        const fallbackTitle = draft.file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80);
        update(draft.id, {
          imageKey: uploadedKey,
          title: fallbackTitle.length >= 2 ? fallbackTitle : "待补充商品名称",
          description: "AI 未能识别，请卖家补充成色、功能与配件情况。",
          riskLevel: "review",
          riskReason: "AI 识别失败，将进入人工审核",
          state: "ready",
        });
      } else {
        const fallbackTitle = draft.file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80);
        update(draft.id, {
          title: fallbackTitle.length >= 2 ? fallbackTitle : "待补充商品名称",
          description: "照片上传失败，请卖家手动补充商品的成色、功能与配件情况。",
          riskLevel: "review",
          riskReason: "未上传商品照片，将进入人工审核",
          state: "ready",
        });
      }
    }
  };

  const selectFiles = async (files: FileList | null) => {
    if (!files) return;
    const available = Math.max(0, 9 - drafts.length);
    const selected = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, available);
    if (!selected.length) return;
    const added: BatchDraft[] = selected.map((file) => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), imageKey: "", title: "", description: "", price: "",
      riskLevel: "review", riskReason: "正在分析", state: "processing",
    }));
    setDrafts((current) => [...current, ...added]);
    setNotice(`正在识别 ${added.length} 件商品，请稍候…`);
    for (const draft of added) await processDraft(draft);
    setNotice("识别完成。请核对商品名称、描述与价格。AI 只负责分流，最终信息由卖家确认。");
  };

  const remove = (id: string) => {
    delete draftCardRefs.current[id];
    delete draftInputRefs.current[id];
    setDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((draft) => draft.id !== id);
    });
  };

  const focusValidationIssue = (issue: NonNullable<ReturnType<typeof findBatchPublishValidationIssue>>) => {
    const issueKey = issue.draftId ? `${issue.key}:${issue.draftId}` : issue.key;
    setInvalidFields(new Set([issueKey]));
    setNotice(issue.message);
    let target: HTMLElement | null = null;
    if (issue.key === "uploads") target = uploadSectionRef.current;
    else if (issue.key === "batch-title") target = batchTitleRef.current;
    else if (issue.key === "map") target = mapSectionRef.current;
    else if (issue.key === "place") target = placeRef.current;
    else if (issue.draftId && issue.key === "draft-state") target = draftCardRefs.current[issue.draftId] ?? null;
    else if (issue.draftId) target = draftInputRefs.current[issue.draftId]?.[issue.key.replace("draft-", "") as "title" | "description" | "price"] ?? null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target?.focus({ preventScroll: true }), 350);
  };

  const submit = async () => {
    if (submitting) return;
    const issue = findBatchPublishValidationIssue({ drafts, title, place, location });
    if (issue) return focusValidationIssue(issue);
    if (!location) return;
    setSubmitting(true);
    const response = await fetch("/api/batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title, place, lat: location.lat, lng: location.lng,
        items: drafts.map(({ title: itemTitle, description, price, imageKey }) => ({
          title: itemTitle, description, price: Number(price), imageKey,
        })),
      }),
    });
    const result = await readJson<{ batch?: { url: string }; error?: string }>(response);
    if (!response.ok || !result?.batch) {
      setNotice(result?.error || "发布失败，请稍后重试。");
      setSubmitting(false);
      return;
    }
    window.location.assign(result.batch.url);
  };

  return (
    <section className="batch-builder">
      <div className="batch-builder-heading">
        <span>BATCH SELLING</span><h1>一组照片，生成整批商品与分享海报</h1>
        <p>最多 9 件商品，共用一个交接地点。AI 识别后，你仍可逐项修改。</p>
      </div>

      <div className="batch-seller-strip">
        <span>卖家公开身份</span><b>{sellerName}</b>{sellerVerified && <em>✓ 已认证</em>}
        <small>海报与批次网页只展示这里的公开身份，可在个人中心修改。</small>
      </div>

      <div className="batch-section-card" ref={uploadSectionRef} tabIndex={-1}>
        <div className="batch-section-title"><b>01</b><div><h2>添加商品照片</h2><p>每件商品一张主图，最多 9 张</p></div></div>
        <label className={`batch-photo-picker ${drafts.length >= 9 ? "disabled" : ""}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={drafts.length >= 9} onChange={(event) => { void selectFiles(event.target.files); event.currentTarget.value = ""; }} />
          <b>＋ 选择多张照片</b><span>{drafts.length}/9</span>
        </label>
        {notice && <p className="batch-notice">{notice}</p>}
        <div className="batch-draft-grid">
          {drafts.map((draft, index) => (
            <article className={`batch-draft ${draft.state} ${invalidFields.has(`draft-state:${draft.id}`) ? "validation-error" : ""}`} key={draft.id} ref={(element) => { draftCardRefs.current[draft.id] = element; }} tabIndex={-1}>
              <div className="batch-draft-photo">
                <Image src={draft.preview} alt="商品预览" fill sizes="220px" unoptimized />
                <span>{index + 1}</span><button type="button" onClick={() => remove(draft.id)}>×</button>
              </div>
              {draft.state === "processing" ? <div className="batch-processing"><i />AI 正在识别…</div> : (
                <div className="batch-draft-fields">
                  <label className={invalidFields.has(`draft-title:${draft.id}`) ? "validation-error" : ""}><span>商品名称</span><input ref={(element) => { (draftInputRefs.current[draft.id] ??= {}).title = element; }} value={draft.title} maxLength={80} onChange={(event) => { update(draft.id, { title: event.target.value }); clearInvalidField(`draft-title:${draft.id}`); }} /></label>
                  <label className={invalidFields.has(`draft-price:${draft.id}`) ? "validation-error" : ""}><span>价格（日元）</span><input ref={(element) => { (draftInputRefs.current[draft.id] ??= {}).price = element; }} type="number" min="0" value={draft.price} placeholder="0 表示免费" onChange={(event) => { update(draft.id, { price: event.target.value }); clearInvalidField(`draft-price:${draft.id}`); }} /></label>
                  <label className={`wide ${invalidFields.has(`draft-description:${draft.id}`) ? "validation-error" : ""}`}><span>商品描述</span><textarea ref={(element) => { (draftInputRefs.current[draft.id] ??= {}).description = element; }} value={draft.description} maxLength={800} onChange={(event) => { update(draft.id, { description: event.target.value }); clearInvalidField(`draft-description:${draft.id}`); }} /></label>
                  <div className={`batch-risk ${draft.riskLevel}`}><b>{draft.riskLevel === "low" ? "可快速发布" : "需人工审核"}</b><span>{draft.riskReason}</span></div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="batch-section-card">
        <div className="batch-section-title"><b>02</b><div><h2>批次信息与统一地点</h2><p>二维码会打开这一批商品的专属页面</p></div></div>
        <label className={`batch-field ${invalidFields.has("batch-title") ? "validation-error" : ""}`}><span>批次名称</span><input ref={batchTitleRef} value={title} maxLength={60} onChange={(event) => { setTitle(event.target.value); clearInvalidField("batch-title"); }} /></label>
        <div ref={mapSectionRef} className={invalidFields.has("map") ? "validation-error batch-map-validation-target" : "batch-map-validation-target"} tabIndex={-1}><PublishLocationMap value={location} onChange={(nextLocation) => { setLocation(nextLocation); clearInvalidField("map"); }} /></div>
        <label className={`batch-field ${invalidFields.has("place") ? "validation-error" : ""}`}><span>地点名称</span><input ref={placeRef} value={place} maxLength={80} placeholder="例如：仙台站东口／川内校园" onChange={(event) => { setPlace(event.target.value); clearInvalidField("place"); }} /></label>
      </div>

      <div className="batch-submit-bar">
        <div><b>发布后立即生成专属网页和竖版海报</b><span>审核中的商品也能预览和转发，联系按钮暂不可用。</span></div>
        <button type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? "正在生成…" : "生成批次与海报"}</button>
      </div>
      {children}
    </section>
  );
}
