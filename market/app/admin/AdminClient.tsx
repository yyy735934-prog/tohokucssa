"use client";

import { useMemo, useState } from "react";
import { shouldShowUserModerationActions } from "../../lib/admin-moderation";

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
  batchId: string | null;
  createdAt: string;
};

type AdminUser = {
  email: string;
  displayName: string;
  role: string;
  academicStatus: string;
  createdAt: string;
};

type AdminAppeal = {
  id: string;
  userEmail: string;
  displayName: string;
  status: string;
  note: string;
  hasImage: boolean;
  createdAt: string;
};

const listingStatusText: Record<string, string> = {
  pending: "待审核",
  active: "展示中",
  rejected: "未通过",
  sold: "已售出",
  withdrawn: "已下架",
};

const academicStatusText: Record<string, string> = {
  pending: "待认证",
  verified: "已认证",
  member: "普通成员",
  rejected: "未通过",
};

export default function AdminClient({
  initialListings,
  initialUsers,
  initialAppeals,
}: {
  initialListings: AdminListing[];
  initialUsers: AdminUser[];
  initialAppeals: AdminAppeal[];
}) {
  const [tab, setTab] = useState<"listings" | "users" | "appeals">("listings");
  const [listingRows, setListingRows] = useState(initialListings);
  const [userRows, setUserRows] = useState(initialUsers);
  const [appealRows, setAppealRows] = useState(initialAppeals);
  const [filter, setFilter] = useState("pending");
  const [message, setMessage] = useState("");

  const visibleListings = useMemo(
    () => (filter === "all" ? listingRows : listingRows.filter((listing) => listing.status === filter)),
    [filter, listingRows],
  );

  const moderate = async (
    targetType: "listing" | "user" | "batch" | "appeal",
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
    } else if (targetType === "batch") {
      setListingRows((current) => current.map((listing) =>
        listing.batchId === targetId && listing.status === "pending" ? { ...listing, status: "active" } : listing,
      ));
    } else if (targetType === "user") {
      setUserRows((current) =>
        current.map((user) => (user.email === targetId ? { ...user, academicStatus: action } : user)),
      );
    } else {
      const appeal = appealRows.find((row) => row.id === targetId);
      setAppealRows((current) => current.map((row) => row.id === targetId ? { ...row, status: action, hasImage: false } : row));
      if (appeal && action === "verified") {
        setUserRows((current) => current.map((user) => user.email === appeal.userEmail ? { ...user, academicStatus: "verified" } : user));
      }
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
        <button className={tab === "appeals" ? "active" : ""} onClick={() => setTab("appeals")}>
          学生身份申诉
          <b>{appealRows.filter((appeal) => appeal.status === "pending").length}</b>
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
              <option value="withdrawn">已下架</option>
              <option value="all">全部商品</option>
            </select>
          </div>
          <div className="admin-list">
            {visibleListings.map((listing, index) => (
              <article key={listing.id}>
                <div
                  className={`admin-item-icon ${listing.imageKey ? "has-image" : ""}`}
                  style={listing.imageKey ? { backgroundImage: `url("/api/images?key=${encodeURIComponent(listing.imageKey)}")` } : undefined}
                >
                  {listing.imageKey ? null : listing.icon}
                </div>
                <div className="admin-item-main">
                  <span>{listing.category} · {listing.place}{listing.batchId ? " · 批量发布" : ""}</span>
                  <h3>{listing.title}</h3>
                  <p>{listing.description}</p>
                  <small>
                    {listing.ownerName} · {listing.ownerEmail} · {listingStatusText[listing.status] ?? listing.status}
                  </small>
                </div>
                <strong>{listing.price === 0 ? "免费" : `¥${listing.price.toLocaleString()}`}</strong>
                <div className="admin-row-actions">
                  {listing.status === "pending" && listing.batchId && !visibleListings.slice(0, index).some((row) => row.batchId === listing.batchId && row.status === "pending") && (
                    <button className="approve batch-approve" onClick={() => moderate("batch", listing.batchId!, "active")}>整批通过</button>
                  )}
                  {listing.status === "pending" && (
                    <>
                      <button className="approve" onClick={() => moderate("listing", listing.id, "active")}>通过</button>
                      <button onClick={() => moderate("listing", listing.id, "rejected")}>拒绝</button>
                    </>
                  )}
                  {listing.status === "active" && (
                    <>
                      <button onClick={() => moderate("listing", listing.id, "withdrawn")}>下架</button>
                      <button onClick={() => moderate("listing", listing.id, "sold")}>标记售出</button>
                    </>
                  )}
                  {["rejected", "withdrawn"].includes(listing.status) && (
                    <button className="approve" onClick={() => moderate("listing", listing.id, "active")}>重新上架</button>
                  )}
                </div>
              </article>
            ))}
            {!visibleListings.length && <div className="admin-empty">当前没有需要处理的商品。</div>}
          </div>
        </div>
      ) : tab === "users" ? (
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
                <span className={`status-pill ${user.academicStatus}`}>
                  {academicStatusText[user.academicStatus] ?? user.academicStatus}
                </span>
                {shouldShowUserModerationActions(user.role, user.academicStatus) && (
                  <div className="admin-row-actions">
                    <button className="approve" onClick={() => moderate("user", user.email, "verified")}>认证为学生</button>
                    <button onClick={() => moderate("user", user.email, "member")}>允许普通成员发布</button>
                    <button onClick={() => moderate("user", user.email, "rejected")}>拒绝</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><span>STUDENT APPEALS</span><h2>学生身份申诉</h2></div>
            <small>证明照片仅限本页查看，处理完成后会从存储中删除</small>
          </div>
          <div className="admin-appeals">
            {appealRows.map((appeal) => (
              <article key={appeal.id}>
                {appeal.hasImage ? <a className="appeal-image" href={`/api/verification/image?appeal=${encodeURIComponent(appeal.id)}`} target="_blank" rel="noreferrer">查看学生证证明</a> : <span className="appeal-image unavailable">证明已删除</span>}
                <div><b>{appeal.displayName}</b><span>{appeal.userEmail}</span><small>{new Date(appeal.createdAt).toLocaleString("zh-CN")}</small></div>
                <span className={`status-pill ${appeal.status}`}>{appeal.status === "pending" ? "待审核" : appeal.status === "verified" ? "已认证" : "未通过"}</span>
                {appeal.status === "pending" && <div className="admin-row-actions"><button className="approve" onClick={() => moderate("appeal", appeal.id, "verified")}>认证为学生</button><button onClick={() => moderate("appeal", appeal.id, "rejected")}>拒绝</button></div>}
              </article>
            ))}
            {!appealRows.length && <div className="admin-empty">当前没有学生身份申诉。</div>}
          </div>
        </div>
      )}
      {message && <div className="portal-toast" role="status">{message}</div>}
    </section>
  );
}
