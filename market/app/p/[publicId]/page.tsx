import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { listingPosterItems, listingPosters, listings, users } from "../../../db/schema";
import { publicMemberName } from "../../../lib/public-identity";
import BatchPoster, { type PosterItem } from "../../b/[publicId]/BatchPoster";

export const dynamic = "force-dynamic";

async function findPoster(publicId: string) {
  const db = await getDb();
  const rows = await db.select().from(listingPosters).where(eq(listingPosters.publicId, publicId)).limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const poster = await findPoster(publicId);
  return poster ? { title: `${poster.title}｜东北集市`, description: "扫码查看海报内商品的实时状态与详情。" } : { title: "海报不存在" };
}

const statusText: Record<string, string> = { active: "出售中", pending: "审核中", sold: "已售出", withdrawn: "已下架", rejected: "未通过" };

export default async function PosterPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const poster = await findPoster(publicId);
  if (!poster) notFound();
  const db = await getDb();
  const [itemRows, creatorRows] = await Promise.all([
    db.select({
      id: listings.id, title: listings.title, description: listings.description, price: listings.price,
      category: listings.category, place: listings.place, status: listings.status, icon: listings.icon,
      imageKey: listings.imageKey, position: listingPosterItems.position,
    }).from(listingPosterItems).innerJoin(listings, eq(listingPosterItems.listingId, listings.id))
      .where(eq(listingPosterItems.posterId, poster.id)).orderBy(asc(listingPosterItems.position)),
    db.select({ publicNameMode: users.publicNameMode, publicNickname: users.publicNickname, academicStatus: users.academicStatus })
      .from(users).where(eq(users.email, poster.creatorEmail)).limit(1),
  ]);
  const creator = creatorRows[0];
  const isAdminPoster = poster.kind === "admin";
  const sellerName = isAdminPoster ? "东北集市精选" : publicMemberName(creator?.publicNameMode, creator?.publicNickname);
  const sellerVerified = !isAdminPoster && creator?.academicStatus === "verified";
  const places = Array.from(new Set(itemRows.map((item) => item.place)));
  const place = places.length === 1 ? places[0] : "仙台多处 · 详见商品";
  const posterItems: PosterItem[] = itemRows.map((item) => ({
    id: item.id, title: item.title, price: item.price, status: item.status, icon: item.icon,
    imageUrl: item.imageKey ? `/api/images?key=${encodeURIComponent(item.imageKey)}` : null,
  }));

  return (
    <main className="batch-public-page">
      <header className="portal-header">
        <Link className="brand" href="/"><span className="brand-mark">东</span><span><b>东北集市</b><small>商品海报</small></span></Link>
        <nav><Link href="/">浏览集市</Link><Link href="/batch/new">制作我的海报</Link></nav>
      </header>
      <section className="batch-public-hero">
        <div><span>MARKET COLLECTION</span><h1>{poster.title}</h1><p>⌖ {place} · 共 {itemRows.length} 件商品</p></div>
        <div className="batch-public-seller"><span>{isAdminPoster ? "推荐" : "卖家"}</span><b>{sellerName}</b>{sellerVerified && <em>✓ 已认证</em>}</div>
      </section>
      <section className="batch-public-layout">
        <BatchPoster title={poster.title} sellerName={sellerName} sellerVerified={sellerVerified} place={place} items={posterItems} />
        <div className="batch-live-list">
          <div className="batch-live-heading"><span>LIVE STATUS</span><h2>商品实时状态</h2></div>
          {itemRows.map((item, index) => (
            <article key={item.id}>
              <div className="batch-live-photo">{item.imageKey ? <Image src={`/api/images?key=${encodeURIComponent(item.imageKey)}`} alt={item.title} fill sizes="82px" unoptimized /> : <span>{item.icon}</span>}<i>{String(index + 1).padStart(2, "0")}</i></div>
              <div><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><small>⌖ {item.place}</small></div>
              <strong>{item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`}</strong>
              {item.status === "active" ? <Link href={`/?listing=${item.id}`}>查看并联系</Link> : <button disabled>{statusText[item.status] ?? item.status}</button>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
