import Link from "next/link";

type MyMarketSection = "account" | "batch" | "favorites" | "map";

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
      {variant === "sidebar" && <>
        <Link href="/account#contacts">交易联系</Link>
        <Link href="/account#profile-contact">联系方式</Link>
        <small>平台不会公开你的邮箱。具体联系方式仅在双方确认交易意向后提供。</small>
      </>}
    </nav>
  );
}
