"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type PosterListingOption = {
  id: string;
  title: string;
  price: number;
  place: string;
  icon: string;
  tone: string;
  imageUrl: string | null;
};

export type PosterHistoryItem = {
  id: string;
  title: string;
  url: string;
  kind: "batch" | "selection";
  createdAt: string;
};

export default function ExistingListingPosterBuilder({ listings }: { listings: PosterListingOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("我的闲置合集");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const selectedCount = selected.length;
  const canCreate = selectedCount >= 2 && selectedCount <= 9 && !creating;
  const selection = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 9 ? [...current, id] : current);
  };

  const createPoster = async () => {
    if (!canCreate) return;
    setCreating(true);
    setMessage("");
    const response = await fetch("/api/posters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingIds: selected, title, scope: "seller" }),
    });
    const result = await response.json().catch(() => null) as { poster?: { url: string }; error?: string } | null;
    if (!response.ok || !result?.poster) {
      setMessage(result?.error ?? "海报生成失败，请稍后重试。");
      setCreating(false);
      return;
    }
    window.location.assign(result.poster.url);
  };

  return (
    <section className="batch-section-card existing-poster-builder">
        <div className="batch-section-title"><b>选</b><div><h2>从已发布商品生成海报</h2><p>选择 2 至 9 件展示中的商品，二维码会打开实时商品合集</p></div></div>
        {listings.length >= 2 ? (
          <>
            <div className="poster-option-grid">
              {listings.map((listing) => (
                <button type="button" className={selection.has(listing.id) ? "selected" : ""} key={listing.id} onClick={() => toggle(listing.id)} aria-pressed={selection.has(listing.id)}>
                  <span className={`poster-option-photo ${listing.tone}`}>
                    {listing.imageUrl ? <Image src={listing.imageUrl} alt="" fill sizes="90px" unoptimized /> : listing.icon}
                    <i>{selection.has(listing.id) ? "✓" : "+"}</i>
                  </span>
                  <span><b>{listing.title}</b><small>{listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString()}`} · {listing.place}</small></span>
                </button>
              ))}
            </div>
            <div className="poster-create-bar">
              <label><span>海报标题</span><input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} /></label>
              <button type="button" disabled={!canCreate} onClick={() => void createPoster()}>{creating ? "正在生成…" : `生成海报（${selectedCount}/9）`}</button>
            </div>
          </>
        ) : <p className="poster-builder-empty">至少有 2 件正在展示的商品后，即可在这里组合生成海报。</p>}
        {message && <p className="batch-notice">{message}</p>}
    </section>
  );
}

export function PosterHistory({ history }: { history: PosterHistoryItem[] }) {
  if (!history.length) return null;
  return (
    <section className="batch-section-card poster-history">
      <div className="batch-section-title"><b>↻</b><div><h2>重新生成、下载与分享</h2><p>打开以前的批量发布或商品合集，按当前状态重新生成二维码海报</p></div></div>
      <div>{history.map((item) => <a href={item.url} key={`${item.kind}-${item.id}`}><span>{item.kind === "batch" ? "批量发布" : "商品合集"}</span><b>{item.title}</b><small>{new Date(item.createdAt).toLocaleDateString("zh-CN")} · 打开、下载或分享 →</small></a>)}</div>
    </section>
  );
}
