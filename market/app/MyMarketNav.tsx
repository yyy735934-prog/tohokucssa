import Link from "next/link";

type MyMarketSection = "account" | "batch" | "favorites" | "map" | "messages";

export default function MyMarketNav({
  active,
  canPublish = true,
  variant = "bar",
}: {
  active: MyMarketSection;
  canPublish?: boolean;
  variant?: "bar" | "sidebar";
}) {
  const className = variant === "sidebar" ? "account-nav" : "my-market-nav";
  return (
    <nav className={className} aria-label="我的集市">
      <b>我的集市</b>
      <Link className={active === "account" ? "active" : ""} href="/account#my-listings">我的发布</Link>
      {canPublish && <Link className={active === "batch" ? "active" : ""} href="/batch/new">批量发布与海报</Link>}
      <Link className={active === "favorites" ? "active" : ""} href="/favorites">我的收藏</Link>
      <Link className={active === "map" ? "active" : ""} href="/map">附近闲置</Link>
      <Link className={active === "messages" ? "active" : ""} href="/messages">交易消息</Link>
      {variant === "sidebar" && <>
        <Link href="/account#public-identity">公开身份</Link>
        <small>买卖双方通过站内匿名聊天沟通；登录邮箱和真实身份不会向对方公开。</small>
      </>}
    </nav>
  );
}
