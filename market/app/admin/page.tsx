import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { listings, users, verificationAppeals } from "../../db/schema";
import { requireAdminAccess } from "../../lib/auth";
import { listingCategoryLabel } from "../../lib/listing-intelligence";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdminAccess("/admin");

  if (!admin) {
    return (
      <main className="portal-page access-denied">
        <span>仅限管理员</span>
        <h1>你没有访问管理后台的权限</h1>
        <p>如果你是学友会运营成员，请联系平台管理员为你的账号开通权限。</p>
        <Link href="/">返回集市</Link>
      </main>
    );
  }

  const db = await getDb();
  const [listingRows, userRows, countRows, appealRows] = await Promise.all([
    db.select().from(listings).orderBy(desc(listings.createdAt)).limit(100),
    db.select().from(users).orderBy(desc(users.createdAt)).limit(100),
    db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${listings.status} = 'pending' then 1 else 0 end)`,
        active: sql<number>`sum(case when ${listings.status} = 'active' then 1 else 0 end)`,
      })
      .from(listings),
    db.select({
      id: verificationAppeals.id,
      userEmail: verificationAppeals.userEmail,
      displayName: users.displayName,
      status: verificationAppeals.status,
      note: verificationAppeals.note,
      hasImage: sql<boolean>`${verificationAppeals.imageKey} is not null`,
      createdAt: verificationAppeals.createdAt,
    }).from(verificationAppeals).innerJoin(users, sql`${verificationAppeals.userEmail} = ${users.email}`).orderBy(desc(verificationAppeals.createdAt)).limit(100),
  ]);
  const counts = countRows[0] ?? { total: 0, pending: 0, active: 0 };
  const pendingUsers = userRows.filter((user) => user.academicStatus === "pending").length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>管理后台</small></span>
        </Link>
        <div>
          <span>{admin.displayName}</span>
          <Link href="/account">个人中心</Link>
          <Link href="/">返回前台</Link>
        </div>
      </header>

      <section className="admin-intro">
        <div>
          <span className="portal-kicker">OPERATIONS CONSOLE</span>
          <h1>平台运行概览</h1>
          <p>集中处理商品审核、学术身份验证和异常内容。</p>
        </div>
        <div className="admin-health"><i></i> 系统运行正常</div>
      </section>

      <section className="admin-stats">
        <article><span>待审核商品</span><b>{Number(counts.pending ?? 0)}</b><small>需要运营确认</small></article>
        <article><span>展示中商品</span><b>{Number(counts.active ?? 0)}</b><small>当前公开可见</small></article>
        <article><span>累计商品</span><b>{Number(counts.total ?? 0)}</b><small>包含售出与下架</small></article>
        <article><span>待认证 / 申诉</span><b>{pendingUsers + appealRows.filter((appeal) => appeal.status === "pending").length}</b><small>成员身份与学生证明</small></article>
      </section>

      <AdminClient
        initialListings={listingRows.map((listing) => ({
          ...listing,
          category: listingCategoryLabel(listing.category),
        }))}
        initialUsers={userRows}
        initialAppeals={appealRows}
      />
    </main>
  );
}
