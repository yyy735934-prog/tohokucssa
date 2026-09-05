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
                <strong>{listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString()}`}</strong>
                {["pending", "active"].includes(listing.status) && (
                  <div className="manage-actions">
                    {listing.status === "active" && <button onClick={() => updateListing(listing.id, "sold")}>标记售出</button>}
                    <button onClick={() => updateListing(listing.id, "withdrawn")}>下架</button>
                  </div>
                )}
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
