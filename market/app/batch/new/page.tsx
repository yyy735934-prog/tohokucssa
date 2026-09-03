import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireMemberAccess } from "../../../lib/auth";
import BatchPublishClient from "./BatchPublishClient";
import { canUseMarketplace } from "../../../lib/member-status";
import MyMarketNav from "../../MyMarketNav";
import { getDb } from "../../../db";
import { listingBatches, listingPosters } from "../../../db/schema";
import { PosterHistory } from "./ExistingListingPosterBuilder";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const member = await requireMemberAccess("/batch/new");
  const canPublish = canUseMarketplace(member.academicStatus, member.isAdmin);
  const db = await getDb();
  const [batches, posters] = canPublish ? await Promise.all([
    db.select().from(listingBatches).where(eq(listingBatches.ownerEmail, member.email)).orderBy(desc(listingBatches.createdAt)).limit(20),
    db.select().from(listingPosters).where(and(eq(listingPosters.creatorEmail, member.email), eq(listingPosters.kind, "seller"))).orderBy(desc(listingPosters.createdAt)).limit(20),
  ]) : [[], []];
  const posterHistory = [
    ...batches.map((batch) => ({ id: batch.id, title: batch.title, url: `/b/${batch.publicId}`, kind: "batch" as const, createdAt: batch.createdAt })),
    ...posters.map((poster) => ({ id: poster.id, title: poster.title, url: `/p/${poster.publicId}`, kind: "selection" as const, createdAt: poster.createdAt })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="batch-publish-page">
      <header className="portal-header">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>批量发布</small></span>
        </Link>
        <nav><Link href="/account">个人中心</Link><Link href="/">返回集市</Link></nav>
      </header>
      <MyMarketNav active="batch" canPublish={canPublish} />
      {canPublish ? (
        <BatchPublishClient sellerName={member.publicName} sellerVerified={member.academicStatus === "verified"}>
          <PosterHistory history={posterHistory} />
        </BatchPublishClient>
      ) : (
        <section className="batch-access-card">
          <span>IDENTITY REQUIRED</span>
          <h1>获得成员发布权限后即可批量发布</h1>
          <p>你可以验证学术邮箱、提交学生证申诉，或等待管理员开通普通成员权限。</p>
          <Link href="/account">返回个人中心</Link>
        </section>
      )}
    </main>
  );
}
