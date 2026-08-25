"use client";

import { useState } from "react";

type Appeal = { id: string; status: string; note: string; createdAt: string } | null;

export default function IdentitySettings({
  academicStatus,
  loginEmail,
  notificationEmail,
  academicEmail,
  initialAppeal,
}: {
  academicStatus: string;
  loginEmail: string;
  notificationEmail: string;
  academicEmail: string;
  initialAppeal: Appeal;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");
  const [academic, setAcademic] = useState("");
  const [academicCode, setAcademicCode] = useState("");
  const [studentCard, setStudentCard] = useState<File | null>(null);
  const [appeal, setAppeal] = useState(initialAppeal);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const post = async (url: string, body: object, key: string) => {
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null) as { error?: string; message?: string; appeal?: Appeal } | null;
      if (!response.ok) throw new Error(result?.error ?? "操作失败，请稍后再试。");
      setMessage(result?.message ?? "操作成功。");
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后再试。");
      return null;
    } finally { setBusy(""); }
  };

  const verifyAndReload = async (url: string, code: string, key: string) => {
    const result = await post(url, { code }, key);
    if (result) window.location.reload();
  };

  const submitAppeal = async () => {
    if (!studentCard) { setMessage("请先选择学生证照片。"); return; }
    setBusy("appeal");
    setMessage("");
    try {
      const form = new FormData();
      form.append("purpose", "verification");
      form.append("image", studentCard);
      const upload = await fetch("/api/uploads", { method: "POST", body: form });
      const uploaded = await upload.json().catch(() => null) as { key?: string; error?: string } | null;
      if (!upload.ok || !uploaded?.key) throw new Error(uploaded?.error ?? "照片上传失败。");
      const response = await fetch("/api/verification/appeals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageKey: uploaded.key }) });
      const result = await response.json().catch(() => null) as { appeal?: Appeal; error?: string; message?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "申诉提交失败。");
      setAppeal(result?.appeal ?? null);
      setMessage(result?.message ?? "学生身份申诉已提交。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "申诉提交失败。"); }
    finally { setBusy(""); }
  };

  const verified = academicStatus === "verified";
  return (
    <section className="identity-settings" id="identity-settings">
      <div className="identity-heading">
        <div><span>IDENTITY & EMAIL</span><h2>身份与收件邮箱</h2></div>
        <small>登录邮箱不会改变；新收件邮箱必须先完成验证码确认。</small>
      </div>
      <div className="identity-grid">
        {verified ? (
          <article>
            <h3>更换收件邮箱</h3>
            <p>学生身份保持不变。今后的平台通知将发送至验证后的收件邮箱。</p>
            <dl><div><dt>登录邮箱</dt><dd>{loginEmail}</dd></div><div><dt>当前收件邮箱</dt><dd>{notificationEmail || loginEmail}</dd></div>{academicEmail && <div><dt>已验证学术邮箱</dt><dd>{academicEmail}</dd></div>}</dl>
            <div className="identity-form-row"><input type="email" placeholder="新的收件邮箱" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /><button disabled={Boolean(busy)} onClick={() => post("/api/profile/email/request", { email: newEmail }, "notification-request")}>{busy === "notification-request" ? "发送中…" : "发送验证码"}</button></div>
            <div className="identity-form-row"><input inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={newEmailCode} onChange={(event) => setNewEmailCode(event.target.value.replace(/\D/g, ""))} /><button disabled={Boolean(busy)} onClick={() => verifyAndReload("/api/profile/email/verify", newEmailCode, "notification-verify")}>确认更换</button></div>
          </article>
        ) : (
          <>
            <article>
              <h3>用学术邮箱自动认证</h3>
              <p>验证码会发送到学校或学术机构邮箱；验证成功后立即获得学生认证。</p>
              <div className="identity-form-row"><input type="email" placeholder="name@university.ac.jp" value={academic} onChange={(event) => setAcademic(event.target.value)} /><button disabled={Boolean(busy)} onClick={() => post("/api/verification/academic-email/request", { email: academic }, "academic-request")}>发送验证码</button></div>
              <div className="identity-form-row"><input inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={academicCode} onChange={(event) => setAcademicCode(event.target.value.replace(/\D/g, ""))} /><button disabled={Boolean(busy)} onClick={() => verifyAndReload("/api/verification/academic-email/verify", academicCode, "academic-verify")}>完成认证</button></div>
            </article>
            <article>
              <h3>上传学生证人工申诉</h3>
              {appeal?.status === "pending" ? (
                <div className="appeal-state pending">申诉已提交，管理员审核后会自动删除证明照片。</div>
              ) : (
                <>
                  {appeal?.status === "rejected" && <div className="appeal-state rejected">上次申诉未通过{appeal.note ? `：${appeal.note}` : "，可重新提交。"}</div>}
                  <p>建议遮挡学号、二维码等无关信息，只保留学校名称、姓名和有效期。支持 JPG、PNG、WebP，最大 4 MB。</p>
                  <label className="student-card-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setStudentCard(event.target.files?.[0] ?? null)} /><b>{studentCard?.name ?? "选择学生证照片"}</b></label>
                  <button className="identity-submit" disabled={Boolean(busy)} onClick={submitAppeal}>{busy === "appeal" ? "提交中…" : "提交人工审核"}</button>
                </>
              )}
            </article>
          </>
        )}
      </div>
      {message && <p className="identity-message" role="status">{message}</p>}
    </section>
  );
}

