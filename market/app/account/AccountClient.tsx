"use client";

import Link from "next/link";
import { useState } from "react";
import ProfileSetup from "../ProfileSetup";
import MyMarketNav from "../MyMarketNav";
import ExistingListingPosterBuilder from "../batch/new/ExistingListingPosterBuilder";

type Listing = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  priceReducedAt?: string | null;
  place: string;
  status: string;
  icon: string;
  tone: string;
  time: string;
  imageUrl?: string | null;
};

const statusText: Record<string, string> = {
  pending: "待审核",
  active: "展示中",
  sold: "已售出",
  rejected: "未通过",
  withdrawn: "已下架",
};

export default function AccountClient({
  initialListings,
  canPublish,
  initialProfile,
}: {
  initialListings: Listing[];
  canPublish: boolean;
  initialProfile: {
    publicNameMode: "anonymous" | "nickname";
    publicNickname: string;
  };
}) {
  const [listings, setListings] = useState(initialListings);
  const [message, setMessage] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const updateListing = async (id: string, status: "sold" | "withdrawn") => {
    const response = await fetch("/api/listings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "操作失败，请稍后再试。");
      return;
    }
    setListings((current) =>
      current.map((listing) => (listing.id === id ? { ...listing, status } : listing)),
    );
    setMessage(status === "sold" ? "已标记为售出。" : "商品已下架。");
  };

  const savePrice = async (listing: Listing) => {
    const nextPrice = Number(priceDraft);
    if (!Number.isSafeInteger(nextPrice) || nextPrice < 0 || nextPrice > 100_000_000) {
      setMessage("请输入 0 至 100,000,000 日元之间的整数价格。");
      return;
    }
    setSavingPrice(true);
    try {
      const response = await fetch("/api/listings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: listing.id, price: nextPrice }),
      });
      const result = await response.json() as { listing?: Listing; reduced?: boolean; error?: string };
      if (!response.ok || !result.listing) {
        setMessage(result.error ?? "价格修改失败，请稍后再试。");
        return;
      }
      setListings((current) => current.map((row) => row.id === listing.id ? { ...row, ...result.listing } : row));
      setEditingPriceId(null);
      setMessage(result.reduced ? "降价成功：商品将在首页优先展示 24 小时。" : "商品价格已更新。");
    } catch {
      setMessage("价格修改失败，请检查网络后重试。");
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <section className="account-workspace">
      <MyMarketNav active="account" canPublish={canPublish} variant="sidebar" />

      <div className="account-panel" id="my-listings">
        <div className="panel-heading">
          <div>
            <span>MY LISTINGS</span>
            <h2>我的发布</h2>
          </div>
          {canPublish ? <div className="account-publish-actions"><Link href="/?publish=1">单件发布</Link><Link href="/batch/new">批量发布与海报</Link></div> : <button disabled>认证后可发布</button>}
        </div>

        {listings.length ? (
          <div className="manage-listings">
            {listings.map((listing) => (
              <article key={listing.id}>
                <div className={`manage-photo ${listing.tone} ${listing.imageUrl ? "has-image" : ""}`} style={listing.imageUrl ? { backgroundImage: `url("${listing.imageUrl}")` } : undefined}>{listing.imageUrl ? null : listing.icon}</div>
                <div className="manage-copy">
                  <span className={`status-pill ${listing.status}`}>{statusText[listing.status] ?? listing.status}</span>
                  <h3>{listing.title}</h3>
                  <p>⌖ {listing.place} · {listing.time}</p>
                </div>
                <div className="manage-price">
                  {listing.originalPrice !== null && listing.originalPrice !== undefined && listing.originalPrice > listing.price && (
                    <del>¥{listing.originalPrice.toLocaleString()}</del>
                  )}
                  <strong>{listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString()}`}</strong>
                </div>
                {["pending", "active"].includes(listing.status) && (
                  <div className="manage-actions">
                    <button onClick={() => { setEditingPriceId(listing.id); setPriceDraft(String(listing.price)); }}>改价格</button>
                    {listing.status === "active" && <button onClick={() => updateListing(listing.id, "sold")}>标记售出</button>}
                    <button onClick={() => updateListing(listing.id, "withdrawn")}>下架</button>
                  </div>
                )}
                {editingPriceId === listing.id && <form className="manage-price-editor" onSubmit={(event) => { event.preventDefault(); void savePrice(listing); }}>
                  <label><span>新价格（日元）</span><input type="number" min="0" max="100000000" step="1" required autoFocus value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)} /></label>
                  <small>降低价格后将保留原价对比，并在首页优先展示 24 小时。</small>
                  <div><button type="button" disabled={savingPrice} onClick={() => setEditingPriceId(null)}>取消</button><button type="submit" disabled={savingPrice}>{savingPrice ? "保存中…" : "保存价格"}</button></div>
                </form>}
              </article>
            ))}
          </div>
        ) : (
          <div className="account-empty">
            <span>📦</span>
            <h3>还没有发布闲置</h3>
            <p>拍一张照片，最快一分钟完成发布。</p>
            {canPublish && <Link href="/?publish=1">发布第一件闲置</Link>}
          </div>
        )}

        {canPublish && (
          <div className="account-poster-builder">
            <ExistingListingPosterBuilder
              listings={listings
                .filter((listing) => listing.status === "active")
                .map((listing) => ({ ...listing, imageUrl: listing.imageUrl ?? null }))}
            />
          </div>
        )}

        <div className="profile-contact-section" id="public-identity">
          <ProfileSetup initialProfile={initialProfile} />
        </div>
      </div>
      {message && <div className="portal-toast" role="status">{message}</div>}
    </section>
  );
}
