import { desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { contactRequests, listings, users, verificationAppeals } from "../../db/schema";
import { chatGPTSignOutPath } from "../chatgpt-auth";
import { requireMemberAccess } from "../../lib/auth";
import { toContactView } from "../../lib/contact-view";
import { listingToMarketItem } from "../../lib/listings";
import { publicMemberName } from "../../lib/public-identity";
import AccountClient from "./AccountClient";
import IdentitySettings from "./IdentitySettings";
import { canUseMarketplace } from "../../lib/member-status";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const member = await requireMemberAccess("/account");
  const db = await getDb();
  const [ownedListings, contacts, profileRows, appealRows] = await Promise.all([
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
      publicNameMode: users.publicNameMode, publicNickname: users.publicNickname,
      notificationEmail: users.notificationEmail, academicEmail: users.academicEmail,
    }).from(users).where(eq(users.email, member.email)).limit(1),
    db.select({ id: verificationAppeals.id, status: verificationAppeals.status, note: verificationAppeals.note, createdAt: verificationAppeals.createdAt }).from(verificationAppeals).where(eq(verificationAppeals.userEmail, member.email)).orderBy(desc(verificationAppeals.createdAt)).limit(1),
  ]);
  const partyEmails = Array.from(new Set(
    contacts.flatMap((contact) => [contact.buyerEmail, contact.sellerEmail]),
  ));
  const partyProfiles = partyEmails.length
    ? await db.select({
        email: users.email,
        phone: users.phone,
        wechat: users.wechat,
        qq: users.qq,
        wechatQrKey: users.wechatQrKey,
        publicNameMode: users.publicNameMode,
        publicNickname: users.publicNickname,
      }).from(users).where(inArray(users.email, partyEmails))
    : [];
  const profileByEmail = new Map(partyProfiles.map((profile) => [profile.email, profile]));

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>个人中心</small></span>
        </Link>
        <nav>
          {member.isAdmin && <Link href="/admin">管理后台</Link>}
          <Link className="portal-map-link" href="/map">二手地图</Link>
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
          <span>{member.academicStatus === "verified" ? "✓" : member.academicStatus === "member" ? "普" : member.academicStatus === "rejected" ? "!" : "◌"}</span>
          <div>
            <b>
              {member.academicStatus === "verified"
                ? "学生身份已认证"
                : member.academicStatus === "member"
                  ? "普通成员"
                : member.academicStatus === "rejected"
                  ? "认证未通过"
                  : "等待学术身份审核"}
            </b>
            <small>
              {member.academicStatus === "verified"
                ? "可发布商品并联系卖家"
                : member.academicStatus === "member"
                  ? "可发布商品并联系卖家；发布内容需经管理员审核"
                : "使用 .ac.jp / .edu 邮箱可自动通过，其他邮箱由管理员人工复核"}
            </small>
          </div>
        </div>
      </section>

      <IdentitySettings
        academicStatus={member.academicStatus}
        loginEmail={member.email}
        notificationEmail={profileRows[0]?.notificationEmail ?? member.email}
        academicEmail={profileRows[0]?.academicEmail ?? ""}
        initialAppeal={appealRows[0] ?? null}
      />

      <AccountClient
        initialListings={ownedListings.map(listingToMarketItem)}
        initialContacts={contacts.map((contact) => {
          const counterpartEmail = contact.sellerEmail === member.email ? contact.buyerEmail : contact.sellerEmail;
          const profile = profileByEmail.get(counterpartEmail);
          const buyerProfile = profileByEmail.get(contact.buyerEmail);
          const sellerProfile = profileByEmail.get(contact.sellerEmail);
          return toContactView({
            ...contact,
            buyerName: publicMemberName(buyerProfile?.publicNameMode, buyerProfile?.publicNickname),
            sellerName: publicMemberName(sellerProfile?.publicNameMode, sellerProfile?.publicNickname),
            counterpartProfile: contact.status === "accepted" ? {
              phone: profile?.phone ?? null,
              wechat: profile?.wechat ?? null,
              qq: profile?.qq ?? null,
              qrUrl: profile?.wechatQrKey ? `/api/profile/qr?contact=${encodeURIComponent(contact.id)}` : null,
            } : null,
          }, member.email);
        })}
        canPublish={canUseMarketplace(member.academicStatus, member.isAdmin)}
        initialProfile={{
          publicNameMode: profileRows[0]?.publicNameMode === "nickname" ? "nickname" : "anonymous",
          publicNickname: profileRows[0]?.publicNickname ?? "",
          phone: profileRows[0]?.phone ?? "",
          wechat: profileRows[0]?.wechat ?? "",
          qq: profileRows[0]?.qq ?? "",
          qrUrl: profileRows[0]?.wechatQrKey ? "/api/profile/qr" : null,
        }}
      />
    </main>
  );
}
