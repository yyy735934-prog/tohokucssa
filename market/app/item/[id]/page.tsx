import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image"; import Link from "next/link"; import { notFound } from "next/navigation";
import { getDb } from "../../../db"; import { listings, users } from "../../../db/schema";
import { listingCategoryLabel } from "../../../lib/listing-intelligence";
import { listingShareDescription, listingShareImageUrl, listingShareTitle, listingShareUrl, type ShareListing } from "../../../lib/listing-share";
import { publicMemberName } from "../../../lib/public-identity"; import ShareButton from "./ShareButton";
export const dynamic = "force-dynamic";

async function findListing(id: string) { const db = await getDb(); const rows = await db.select({ listing: listings, publicNameMode: users.publicNameMode, publicNickname: users.publicNickname, academicStatus: users.academicStatus }).from(listings).leftJoin(users, eq(listings.ownerEmail, users.email)).where(eq(listings.id, id)).limit(1); return rows[0] ?? null; }
function shared(row: NonNullable<Awaited<ReturnType<typeof findListing>>>): ShareListing { const x = row.listing; return { id:x.id,title:x.title,price:x.price,description:x.description,place:x.place,category:listingCategoryLabel(x.category),status:x.status,imageKey:x.imageKey,imageUrl:x.imageKey ? `/api/images?key=${encodeURIComponent(x.imageKey)}` : null,icon:x.icon }; }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const row = await findListing(id);
  if (!row || row.listing.status === "rejected") return { title: "商品不可用｜东北集市", description: "该商品不存在或不可公开查看。", robots: { index:false, follow:false }, openGraph: { images: [] }, twitter: { images: [] } };
  const item = shared(row); const title = listingShareTitle(item); const description = listingShareDescription(item); const url = listingShareUrl(item.id); const image = listingShareImageUrl(item);
  return { title, description, alternates:{ canonical:url }, robots:item.status === "pending" ? { index:false,follow:false } : undefined, openGraph:{ type:"website",siteName:"东北集市",title,description,url,images:[{url:image,width:1200,height:630}] }, twitter:{card:"summary_large_image",title,description,images:[image]} };
}

const statusCopy: Record<string,string> = { sold:"✓ 已找到新主人",pending:"商品正在审核",withdrawn:"该商品已下架" };
export default async function ItemPage({ params }: { params: Promise<{ id:string }> }) {
  const { id } = await params; const row = await findListing(id); if (!row || row.listing.status === "rejected") notFound(); const item = shared(row); const active = item.status === "active"; const seller = publicMemberName(row.publicNameMode,row.publicNickname);
  return <main className="item-public-page"><header className="portal-header"><Link className="brand" href="/"><span className="brand-mark">东</span><span><b>东北集市</b><small>学友会二手平台</small></span></Link><nav><Link href="/">浏览集市</Link></nav></header>
    <article className="item-public-card"><div className="item-public-photo">{row.listing.imageKey ? <Image src={`/api/images?key=${encodeURIComponent(row.listing.imageKey)}`} alt={item.title} fill priority sizes="(max-width:760px) 100vw,52vw" unoptimized /> : <span>{row.listing.icon}</span>}</div>
      <div className="item-public-content">{statusCopy[item.status] && <div className={`item-status ${item.status}`}>{statusCopy[item.status]}</div>}{item.status === "pending" && <p className="item-status-note">审核通过后将自动开放完整交易入口</p>}<span className="detail-category">{item.category}</span><h1>{item.title}</h1><div className="detail-price">{item.price === 0 ? "免费赠送" : `¥${item.price.toLocaleString("zh-CN")}`}</div><p className="item-description">{item.description}</p><div className="pickup">⌖ 交易地点 <b>{item.place}附近公共场所</b></div><div className="seller-row"><span>{seller.slice(0,1)}</span><div><b>{seller}</b><small>{row.academicStatus === "verified" ? "✓ 已认证学友" : "身份待核验"}</small></div></div>
        <div className="item-public-actions">{active && <Link className="contact-link" href={`/?listing=${encodeURIComponent(item.id)}`}>联系卖家 / 收藏</Link>}<ShareButton listing={item} />{!active && <Link className="browse-link" href="/">{item.status === "sold" ? "看看其他在售商品" : "返回东北集市"}</Link>}</div><small className="safety-note">请勿提前转账；当面验货确认后再完成交易。</small>
      </div></article></main>;
}
