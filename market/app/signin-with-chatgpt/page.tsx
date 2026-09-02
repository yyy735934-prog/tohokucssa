import type { Metadata } from "next";
import Link from "next/link";
import { safeRelativeReturnPath } from "../chatgpt-auth";
import EmailSignInClient from "./EmailSignInClient";
import styles from "./signin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录｜东北集市",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(
    typeof params.return_to === "string" ? params.return_to : "/",
  );
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as {
    EMAIL?: unknown;
    EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
    GOOGLE_CLIENT_ID?: string;
  };
  const emailEnabled = Boolean(
    (runtimeEnv.EMAIL || runtimeEnv.RESEND_API_KEY?.trim()) &&
      runtimeEnv.EMAIL_FROM?.trim(),
  );
  const googleEnabled = Boolean(runtimeEnv.GOOGLE_CLIENT_ID?.trim());

  return (
    <main className={styles.page}>
      <Link className={styles.brand} href="/">
        <span>东</span>
        <b>东北集市</b>
        <small>学友会二手平台</small>
      </Link>
      <section className={styles.card}>
        <span className="portal-kicker">MEMBER ACCESS</span>
        <h1>登录或注册</h1>
        <p>邮箱验证成功后会自动创建账号，无需设置密码。</p>
        <EmailSignInClient
          returnTo={returnTo}
          emailEnabled={emailEnabled}
          googleEnabled={googleEnabled}
        />
        <small className={styles.footnote}>
          学术邮箱自动认证；其他邮箱注册后由学友会管理员确认成员身份。
        </small>
      </section>
    </main>
  );
}
