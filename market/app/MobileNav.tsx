"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MobileNavProps = {
  active?: "home" | "map" | "messages" | "account";
  viewer?: boolean;
  homeHref?: string;
  onPublish?: () => void;
};

function EnvelopeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z" /><path d="m4.2 7.2 7.8 6 7.8-6" /></svg>;
}

function PublishIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export default function MobileNav({ active, viewer = true, homeHref = "/", onPublish }: MobileNavProps) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const messagesHref = viewer ? "/messages" : "/signin-with-chatgpt?return_to=%2Fmessages";
  const accountHref = viewer ? "/account" : "/signin-with-chatgpt?return_to=%2Faccount";

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;

    const refreshUnread = async () => {
      try {
        const response = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { unread?: unknown };
        const count = Math.max(0, Math.trunc(Number(result.unread) || 0));
        if (!cancelled) setUnreadMessages(count);
      } catch {
        // Navigation remains usable if the lightweight unread check is unavailable.
      }
    };

    void refreshUnread();
    const interval = window.setInterval(() => void refreshUnread(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [viewer]);

  const unreadLabel = unreadMessages > 99 ? "99+" : String(unreadMessages);
  return <nav className="mobile-nav" aria-label="移动端导航">
    <Link className={active === "home" ? "active" : ""} href={homeHref}><span>⌂</span>首页</Link>
    <Link className={active === "map" ? "active" : ""} href="/map"><span>⌖</span>附近</Link>
    {onPublish
      ? <button className="nav-publish" type="button" aria-label="发布闲置" onClick={onPublish}><PublishIcon /></button>
      : <Link className="nav-publish" href="/?publish=1" aria-label="发布闲置"><PublishIcon /></Link>}
    <Link
      className={active === "messages" ? "active" : ""}
      href={messagesHref}
      aria-label={unreadMessages ? `消息，${unreadMessages} 条未读` : "消息"}
    >
      <span className="nav-envelope">
        <EnvelopeIcon />
        {unreadMessages > 0 && <i className="mobile-nav-unread" aria-hidden="true">{unreadLabel}</i>}
      </span>
      消息
    </Link>
    <Link className={active === "account" ? "active" : ""} href={accountHref}><span>♙</span>我的</Link>
  </nav>;
}
