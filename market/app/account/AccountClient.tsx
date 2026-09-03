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

type ContactRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  direction: "incoming" | "outgoing";
  counterpartName: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  counterpartContact: {
    phone: string | null;
    wechat: string | null;
    qq: string | null;
    qrUrl: string | null;
  } | null;
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
  initialContacts,
  canPublish,
  initialProfile,
}: {
  initialListings: Listing[];
  initialContacts: ContactRequest[];
  canPublish: boolean;
  initialProfile: {
    publicNameMode: "anonymous" | "nickname";
    publicNickname: string;
    phone: string;
    wechat: string;
    qq: string;
    qrUrl: string | null;
  };
}) {
  const [listings, setListings] = useState(initialListings);
  const [contacts, setContacts] = useState(initialContacts);
  const [message, setMessage] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

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

  const respondToContact = async (id: string, status: "accepted" | "declined") => {
    setRespondingId(id);
    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        code?: string;
      } | null;
      if (!response.ok) {
        setMessage(result?.error ?? "处理联系申请失败，请稍后再试。");
        if (result?.code === "CONTACT_PROFILE_REQUIRED") {
          document.getElementById("profile-contact")?.scrollIntoView({ behavior: "smooth" });
        }
        return;
      }
      setContacts((current) =>
        current.map((contact) => (contact.id === id ? { ...contact, status } : contact)),
      );
      setMessage(result?.message ?? (status === "accepted" ? "已接受联系申请。" : "已拒绝联系申请。"));
      if (status === "accepted") window.location.reload();
    } catch {
      setMessage("处理联系申请失败，请检查网络后重试。");
    } finally {
      setRespondingId(null);
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

        <div className="contact-section" id="contacts">
          <div className="panel-heading">
            <div><span>CONTACT REQUESTS</span><h2>交易联系</h2></div>
            <small>{contacts.filter((contact) => contact.status === "pending").length} 条待处理</small>
          </div>
          {contacts.length ? (
            <div className="contact-list">
              {contacts.map((contact) => {
                const isSeller = contact.direction === "incoming";
                return (
                  <article key={contact.id}>
                    <div className="contact-icon">{isSeller ? "收" : "发"}</div>
                    <div>
                      <span>{isSeller ? "买家联系你" : "已联系卖家"}</span>
                      <b>{contact.listingTitle}</b>
                      <small>
                        {contact.status === "accepted"
                          ? `已同意 · ${contact.counterpartName}`
                          : contact.status === "declined"
                            ? "已拒绝"
                            : isSeller ? `${contact.counterpartName} 等待你的确认` : "等待卖家确认"}
                      </small>
                    </div>
                    {contact.status === "accepted" && contact.counterpartContact && (
                      <div className="shared-contact">
                        {contact.counterpartContact.phone && <span>电话 <b>{contact.counterpartContact.phone}</b></span>}
                        {contact.counterpartContact.wechat && <span>微信 <b>{contact.counterpartContact.wechat}</b></span>}
                        {contact.counterpartContact.qq && <span>QQ <b>{contact.counterpartContact.qq}</b></span>}
                        {contact.counterpartContact.qrUrl && <a href={contact.counterpartContact.qrUrl} target="_blank" rel="noreferrer">查看微信二维码</a>}
                      </div>
                    )}
                    <span className={`status-pill ${contact.status}`}>
                      {contact.status === "accepted" ? "已接受" : contact.status === "declined" ? "已拒绝" : "待确认"}
                    </span>
                    {isSeller && contact.status === "pending" && (
                      <div className="manage-actions">
                        <button disabled={respondingId === contact.id} onClick={() => respondToContact(contact.id, "accepted")}>接受</button>
                        <button disabled={respondingId === contact.id} onClick={() => respondToContact(contact.id, "declined")}>拒绝</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="contact-empty">暂时没有交易联系。浏览商品后，可向卖家发送联系申请。</div>
          )}
        </div>
        <div className="profile-contact-section" id="profile-contact">
          <ProfileSetup initialProfile={initialProfile} />
        </div>
      </div>
      {message && <div className="portal-toast" role="status">{message}</div>}
    </section>
  );
}
