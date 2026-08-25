import Link from "next/link";
import { requireMemberAccess } from "../../../lib/auth";
import BatchPublishClient from "./BatchPublishClient";
import { canUseMarketplace } from "../../../lib/member-status";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const member = await requireMemberAccess("/batch/new");
  const canPublish = canUseMarketplace(member.academicStatus, member.isAdmin);

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
          <h1>获得成员发布权限后即可批量发布</h1>
          <p>你可以验证学术邮箱、提交学生证申诉，或等待管理员开通普通成员权限。</p>
          <Link href="/account">返回个人中心</Link>
        </section>
      )}
    </main>
  );
}
