"use client";

import Image from "next/image";
import { useState } from "react";

type InitialProfile = {
  publicNameMode?: "anonymous" | "nickname";
  publicNickname?: string | null;
  phone?: string | null;
  wechat?: string | null;
  qq?: string | null;
  qrUrl?: string | null;
};

export default function ProfileSetup({
  initialProfile,
  onboarding = false,
  onComplete,
}: {
  initialProfile?: InitialProfile;
  onboarding?: boolean;
  onComplete?: () => void;
}) {
  const [publicNameMode, setPublicNameMode] = useState<"anonymous" | "nickname">(
    initialProfile?.publicNameMode === "nickname" ? "nickname" : "anonymous",
  );
  const [publicNickname, setPublicNickname] = useState(initialProfile?.publicNickname ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [wechat, setWechat] = useState(initialProfile?.wechat ?? "");
  const [qq, setQq] = useState(initialProfile?.qq ?? "");
  const [qrUrl, setQrUrl] = useState(initialProfile?.qrUrl ?? "");
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const uploadQr = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    form.append("purpose", "profile");
    setMessage("正在上传二维码…");
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const result = (await response.json()) as { key?: string; error?: string };
    if (!response.ok || !result.key) {
      setMessage(result.error ?? "二维码上传失败。");
      return;
    }
    setQrKey(result.key);
    setQrUrl(URL.createObjectURL(file));
    setMessage("二维码已上传，请保存联系方式。");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicNameMode,
        publicNickname,
        phone,
        wechat,
        qq,
        wechatQrKey: qrKey,
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setSaving(false);
    setMessage(result.message ?? result.error ?? "暂时无法保存。");
    if (response.ok) onComplete?.();
  };

  return (
    <form className={`profile-setup ${onboarding ? "onboarding" : ""}`} onSubmit={submit}>
      <div className="profile-setup-heading">
        <span>{onboarding ? "WELCOME" : "CONTACT PROFILE"}</span>
        <h2>{onboarding ? "先留下一个方便联系你的方式" : "交易联系方式"}</h2>
        <p>只有双方确认交易意向后，联系方式才会向对方展示。至少填写一项。</p>
      </div>
      <fieldset className="public-identity-fieldset">
        <legend>公开身份</legend>
        <label className={publicNameMode === "anonymous" ? "selected" : ""}>
          <input
            type="radio"
            name="publicNameMode"
            checked={publicNameMode === "anonymous"}
            onChange={() => setPublicNameMode("anonymous")}
          />
          <span><b>匿名卖家</b><small>默认选项；公开页面只显示认证状态</small></span>
        </label>
        <label className={publicNameMode === "nickname" ? "selected" : ""}>
          <input
            type="radio"
            name="publicNameMode"
            checked={publicNameMode === "nickname"}
            onChange={() => setPublicNameMode("nickname")}
          />
          <span><b>使用昵称</b><small>买家会看到你主动设置的昵称</small></span>
        </label>
        {publicNameMode === "nickname" && (
          <input
            className="public-nickname-input"
            value={publicNickname}
            onChange={(event) => setPublicNickname(event.target.value)}
            minLength={2}
            maxLength={20}
            required
            placeholder="输入 2–20 字昵称"
          />
        )}
        <p>Google 姓名和登录邮箱不会出现在商品页、地图或联系申请中。</p>
      </fieldset>
      <div className="contact-field-grid">
        <label><span>手机 / 电话</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例如：090-1234-5678" /></label>
        <label><span>微信号</span><input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="填写微信 ID" /></label>
        <label><span>QQ 号</span><input value={qq} onChange={(e) => setQq(e.target.value)} placeholder="填写 QQ 号" /></label>
        <label className="qr-upload">
          <span>微信二维码（可选）</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadQr(file); }} />
          <b>{qrUrl ? "✓ 已选择二维码" : "＋ 上传二维码"}</b>
        </label>
      </div>
      {qrUrl && <Image className="profile-qr-preview" src={qrUrl} alt="微信二维码预览" width={86} height={86} unoptimized />}
      <div className="profile-setup-actions">
        <small>{message || "联系方式不会出现在公开商品页。"}</small>
        <button type="submit" disabled={saving}>{saving ? "保存中…" : "保存并继续"}</button>
      </div>
    </form>
  );
}
