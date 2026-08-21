import { desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { contactRequests, listings, users } from "../../db/schema";
import { chatGPTSignOutPath } from "../chatgpt-auth";
import { requireMemberAccess } from "../../lib/auth";
import { listingToMarketItem } from "../../lib/listings";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const member = await requireMemberAccess("/account");
  const db = await getDb();
  const [ownedListings, contacts, profileRows] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(eq(listings.ownerEmail, member.email))
      .orderBy(desc(listings.createdAt))
      .limit(50),
    db
      .select({
        id: contactRequests.id,
        listingId: contactRequests.listingId,
        listingTitle: listings.title,
        buyerEmail: contactRequests.buyerEmail,
        buyerName: contactRequests.buyerName,
        sellerEmail: contactRequests.sellerEmail,
        status: contactRequests.status,
        createdAt: contactRequests.createdAt,
      })
      .from(contactRequests)
      .innerJoin(listings, eq(contactRequests.listingId, listings.id))
      .where(or(eq(contactRequests.buyerEmail, member.email), eq(contactRequests.sellerEmail, member.email)))
      .orderBy(desc(contactRequests.createdAt))
      .limit(50),
    db.select({
      phone: users.phone, wechat: users.wechat, qq: users.qq, wechatQrKey: users.wechatQrKey,
    }).from(users).where(eq(users.email, member.email)).limit(1),
  ]);
  const counterpartEmails = Array.from(new Set(
    contacts.map((contact) => contact.sellerEmail === member.email ? contact.buyerEmail : contact.sellerEmail),
  ));
  const counterpartProfiles = counterpartEmails.length
    ? await db.select({
        email: users.email, phone: users.phone, wechat: users.wechat, qq: users.qq, wechatQrKey: users.wechatQrKey,
      }).from(users).where(inArray(users.email, counterpartEmails))
    : [];
  const profileByEmail = new Map(counterpartProfiles.map((profile) => [profile.email, profile]));

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>个人中心</small></span>
        </Link>
        <nav>
          {member.isAdmin && <Link href="/admin">管理后台</Link>}
          <Link href="/map">二手地图</Link>
          <a href={chatGPTSignOutPath("/")}>退出登录</a>
        </nav>
      </header>

      <section className="portal-hero">
        <div className="portal-avatar">{member.displayName.slice(0, 1).toUpperCase()}</div>
        <div>
          <span className="portal-kicker">MEMBER CENTER</span>
          <h1>{member.displayName}</h1>
          <p>{member.email}</p>
        </div>
        <div className={`verification-card ${member.academicStatus}`}>
          <span>{member.academicStatus === "verified" ? "✓" : member.academicStatus === "rejected" ? "!" : "◌"}</span>
          <div>
            <b>
              {member.academicStatus === "verified"
                ? "学友身份已验证"
                : member.academicStatus === "rejected"
                  ? "认证未通过"
                  : "等待学术身份审核"}
            </b>
            <small>
              {member.academicStatus === "verified"
                ? "可发布商品并联系卖家"
                : "使用 .ac.jp / .edu 邮箱可自动通过，其他邮箱由管理员人工复核"}
            </small>
          </div>
        </div>
      </section>

      <AccountClient
        initialListings={ownedListings.map(listingToMarketItem)}
        initialContacts={contacts.map((contact) => {
          const counterpartEmail = contact.sellerEmail === member.email ? contact.buyerEmail : contact.sellerEmail;
          const profile = profileByEmail.get(counterpartEmail);
          return {
            ...contact,
            counterpartContact: profile ? {
              phone: profile.phone,
              wechat: profile.wechat,
              qq: profile.qq,
              qrUrl: profile.wechatQrKey ? `/api/profile/qr?email=${encodeURIComponent(counterpartEmail)}` : null,
            } : null,
          };
        })}
        currentEmail={member.email}
        canPublish={member.academicStatus === "verified" || member.isAdmin}
        initialProfile={{
          phone: profileRows[0]?.phone ?? "",
          wechat: profileRows[0]?.wechat ?? "",
          qq: profileRows[0]?.qq ?? "",
          qrUrl: profileRows[0]?.wechatQrKey ? `/api/profile/qr?email=${encodeURIComponent(member.email)}` : null,
        }}
      />
    </main>
  );
}
