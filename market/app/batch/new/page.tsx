import Link from "next/link";
import { requireMemberAccess } from "../../../lib/auth";
import BatchPublishClient from "./BatchPublishClient";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const member = await requireMemberAccess("/batch/new");
  const canPublish = member.academicStatus === "verified" || member.isAdmin;

  return (
    <main className="batch-publish-page">
      <header className="portal-header">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>批量发布</small></span>
        </Link>
        <nav><Link href="/account">个人中心</Link><Link href="/">返回集市</Link></nav>
      </header>
      {canPublish ? (
        <BatchPublishClient sellerName={member.publicName} sellerVerified={member.academicStatus === "verified"} />
      ) : (
        <section className="batch-access-card">
          <span>IDENTITY REQUIRED</span>
          <h1>完成学友身份认证后即可批量发布</h1>
          <p>你的账号仍在认证中。通过后可一次上传最多 9 件商品。</p>
          <Link href="/account">返回个人中心</Link>
        </section>
      )}
    </main>
  );
}
