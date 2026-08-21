"use client";

import { FormEvent, useState } from "react";
import styles from "./signin.module.css";

export default function EmailSignInClient({
  returnTo,
  emailEnabled,
  googleEnabled,
}: {
  returnTo: string;
  emailEnabled: boolean;
  googleEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setMessage(result?.error ?? "验证码发送失败，请稍后重试。");
        return;
      }
      setCodeRequested(true);
      setMessage(result?.message ?? "验证码已发送，请检查邮箱。");
    } catch {
      setMessage("验证码发送失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, returnTo }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        returnTo?: string;
      } | null;
      if (!response.ok) {
        setMessage(result?.error ?? "验证码验证失败，请重新获取。");
        return;
      }
      window.location.assign(result?.returnTo ?? "/");
    } catch {
      setMessage("登录失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.options}>
      {emailEnabled ? (
        codeRequested ? (
          <form className={styles.form} onSubmit={verifyCode}>
            <label>
              验证码已发送至
              <b>{email}</b>
            </label>
            <input
              aria-label="六位邮箱验证码"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="请输入 6 位验证码"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            <button disabled={busy || code.length !== 6} type="submit">
              {busy ? "正在验证…" : "验证并登录"}
            </button>
            <button
              className={styles.textButton}
              disabled={busy}
              type="button"
              onClick={() => {
                setCodeRequested(false);
                setCode("");
                setMessage("");
              }}
            >
              更换邮箱
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={requestCode}>
            <label htmlFor="signin-email">邮箱地址</label>
            <input
              id="signin-email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button disabled={busy} type="submit">
              {busy ? "正在发送…" : "获取邮箱验证码"}
            </button>
          </form>
        )
      ) : (
        <div className={styles.note}>
          邮箱验证码入口已完成，管理员配置发件域名后即可启用。
        </div>
      )}

      {message && <div className={styles.message} role="status">{message}</div>}

      {googleEnabled && (
        <>
          <div className={styles.divider}><span>或</span></div>
          <a
            className={styles.googleButton}
            href={`/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`}
          >
            使用 Google 登录
          </a>
        </>
      )}
    </div>
  );
}
