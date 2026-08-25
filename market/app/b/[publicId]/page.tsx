import { and, asc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { listingBatches, listings, users } from "../../../db/schema";
import { publicMemberName } from "../../../lib/public-identity";
import BatchPoster, { type PosterItem } from "./BatchPoster";

export const dynamic = "force-dynamic";

async function findBatch(publicId: string) {
  const db = await getDb();
  const rows = await db.select().from(listingBatches).where(eq(listingBatches.publicId, publicId)).limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const batch = await findBatch(publicId);
  if (!batch) return { title: "批次不存在" };
  const db = await getDb();
  const pending = await db.select({ id: listings.id }).from(listings)
    .where(and(eq(listings.batchId, batch.id), eq(listings.status, "pending"))).limit(1);
  return {
    title: `${batch.title}｜东北集市`,
    description: `${batch.place}的一批二手物品`,
    robots: pending.length ? { index: false, follow: false } : { index: true, follow: true },
  };
}

const statusText: Record<string, string> = { pending: "审核中", active: "出售中", sold: "已售出", withdrawn: "已下架" };

export default async function BatchPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const batch = await findBatch(publicId);
  if (!batch) notFound();
  const db = await getDb();
  const [itemRows, sellerRows] = await Promise.all([
    db.select().from(listings)
      .where(and(eq(listings.batchId, batch.id), ne(listings.status, "rejected")))
      .orderBy(asc(listings.batchPosition)),
    db.select({ publicNameMode: users.publicNameMode, publicNickname: users.publicNickname, academicStatus: users.academicStatus })
      .from(users).where(eq(users.email, batch.ownerEmail)).limit(1),
  ]);
  const seller = sellerRows[0];
  const sellerName = publicMemberName(seller?.publicNameMode, seller?.publicNickname);
  const sellerVerified = seller?.academicStatus === "verified";
  const posterItems: PosterItem[] = itemRows.map((item) => ({
    id: item.id, title: item.title, price: item.price, status: item.status, icon: item.icon,
    imageUrl: item.imageKey ? `/api/images?key=${encodeURIComponent(item.imageKey)}` : null,
  }));
  const hasPending = itemRows.some((item) => item.status === "pending");

  return (
    <main className="batch-public-page">
      <header className="portal-header">
        <Link className="brand" href="/"><span className="brand-mark">东</span><span><b>东北集市</b><small>批次专页</small></span></Link>
        <nav><Link href="/">浏览集市</Link><Link href="/batch/new">我也要批量发布</Link></nav>
      </header>
      <section className="batch-public-hero">
        <div>
          <span>SECONDHAND COLLECTION</span><h1>{batch.title}</h1>
          <p>⌖ {batch.place} · 共 {itemRows.length} 件商品</p>
        </div>
        <div className="batch-public-seller"><span>卖家</span><b>{sellerName}</b>{sellerVerified && <em>✓ 已认证</em>}</div>
      </section>
      {hasPending && <div className="batch-review-banner"><b>这批商品正在审核</b><span>海报可提前分享；商品通过后会自动开放联系入口。</span></div>}
      <section className="batch-public-layout">
        <BatchPoster title={batch.title} sellerName={sellerName} sellerVerified={sellerVerified} place={batch.place} items={posterItems} />
        <div className="batch-live-list">
          <div className="batch-live-heading"><span>LIVE STATUS</span><h2>商品实时状态</h2></div>
          {itemRows.map((item, index) => (
            <article key={item.id}>
              <div className="batch-live-photo">
                {item.imageKey ? <Image src={`/api/images?key=${encodeURIComponent(item.imageKey)}`} alt={item.title} fill sizes="82px" unoptimized /> : <span>{item.icon}</span>}
                <i>{String(index + 1).padStart(2, "0")}</i>
              </div>
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
