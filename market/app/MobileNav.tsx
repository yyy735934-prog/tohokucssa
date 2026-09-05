"use client";

import Link from "next/link";

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
  const messagesHref = viewer ? "/messages" : "/signin-with-chatgpt?return_to=%2Fmessages";
  const accountHref = viewer ? "/account" : "/signin-with-chatgpt?return_to=%2Faccount";
  return <nav className="mobile-nav" aria-label="移动端导航">
    <Link className={active === "home" ? "active" : ""} href={homeHref}><span>⌂</span>首页</Link>
    <Link className={active === "map" ? "active" : ""} href="/map"><span>⌖</span>附近</Link>
    {onPublish
      ? <button className="nav-publish" type="button" aria-label="发布闲置" onClick={onPublish}><PublishIcon /></button>
      : <Link className="nav-publish" href="/?publish=1" aria-label="发布闲置"><PublishIcon /></Link>}
    <Link className={active === "messages" ? "active" : ""} href={messagesHref}>
      <span className="nav-envelope"><EnvelopeIcon /></span>消息
    </Link>
    <Link className={active === "account" ? "active" : ""} href={accountHref}><span>♙</span>我的</Link>
  </nav>;
}
