"use client";

import { useMemo, useState } from "react";

type AdminListing = {
  id: string;
  ownerEmail: string;
  ownerName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  place: string;
  status: string;
  icon: string;
  imageKey: string | null;
  createdAt: string;
};

type AdminUser = {
  email: string;
  displayName: string;
  role: string;
  academicStatus: string;
  createdAt: string;
};

export default function AdminClient({
  initialListings,
  initialUsers,
}: {
  initialListings: AdminListing[];
  initialUsers: AdminUser[];
}) {
  const [tab, setTab] = useState<"listings" | "users">("listings");
  const [listingRows, setListingRows] = useState(initialListings);
  const [userRows, setUserRows] = useState(initialUsers);
  const [filter, setFilter] = useState("pending");
  const [message, setMessage] = useState("");

  const visibleListings = useMemo(
    () => (filter === "all" ? listingRows : listingRows.filter((listing) => listing.status === filter)),
    [filter, listingRows],
  );

  const moderate = async (
    targetType: "listing" | "user",
    targetId: string,
    action: string,
  ) => {
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, action }),
    });
    if (!response.ok) {
      setMessage("操作失败，请刷新后重试。");
      return;
    }
    if (targetType === "listing") {
      setListingRows((current) =>
        current.map((listing) => (listing.id === targetId ? { ...listing, status: action } : listing)),
      );
    } else {
      setUserRows((current) =>
        current.map((user) => (user.email === targetId ? { ...user, academicStatus: action } : user)),
      );
    }
    setMessage("已保存审核结果。");
  };

  return (
    <section className="admin-workspace">
      <nav className="admin-tabs" aria-label="管理功能">
        <button className={tab === "listings" ? "active" : ""} onClick={() => setTab("listings")}>
          商品审核
          <b>{listingRows.filter((listing) => listing.status === "pending").length}</b>
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          用户认证
          <b>{userRows.filter((user) => user.academicStatus === "pending").length}</b>
        </button>
      </nav>

      {tab === "listings" ? (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><span>MODERATION</span><h2>商品审核队列</h2></div>
            <select aria-label="筛选商品状态" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="pending">待审核</option>
              <option value="active">展示中</option>
              <option value="rejected">未通过</option>
              <option value="sold">已售出</option>
              <option value="all">全部商品</option>
            </select>
          </div>
          <div className="admin-list">
            {visibleListings.map((listing) => (
              <article key={listing.id}>
                <div
                  className={`admin-item-icon ${listing.imageKey ? "has-image" : ""}`}
                  style={listing.imageKey ? { backgroundImage: `url("/api/images?key=${encodeURIComponent(listing.imageKey)}")` } : undefined}
                >
                  {listing.imageKey ? null : listing.icon}
                </div>
                <div className="admin-item-main">
                  <span>{listing.category} · {listing.place}</span>
                  <h3>{listing.title}</h3>
                  <p>{listing.description}</p>
                  <small>{listing.ownerName} · {listing.ownerEmail}</small>
                </div>
                <strong>{listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString()}`}</strong>
                <div className="admin-row-actions">
                  {listing.status !== "active" && <button className="approve" onClick={() => moderate("listing", listing.id, "active")}>通过</button>}
                  {listing.status !== "rejected" && <button onClick={() => moderate("listing", listing.id, "rejected")}>驳回</button>}
                </div>
              </article>
            ))}
            {!visibleListings.length && <div className="admin-empty">当前没有需要处理的商品。</div>}
          </div>
        </div>
      ) : (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><span>MEMBERS</span><h2>学术身份认证</h2></div>
            <small>.ac.jp / .edu 邮箱自动通过，其余邮箱在此人工复核</small>
          </div>
          <div className="admin-users">
            {userRows.map((user) => (
              <article key={user.email}>
                <div className="admin-user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
                <div><b>{user.displayName}</b><span>{user.email}</span></div>
                <span className={`status-pill ${user.academicStatus}`}>{user.academicStatus}</span>
                {user.role !== "admin" && (
                  <div className="admin-row-actions">
                    <button className="approve" onClick={() => moderate("user", user.email, "verified")}>通过认证</button>
                    <button onClick={() => moderate("user", user.email, "rejected")}>拒绝</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {message && <div className="portal-toast" role="status">{message}</div>}
    </section>
  );
}
