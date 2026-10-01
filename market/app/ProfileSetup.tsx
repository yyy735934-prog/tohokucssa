"use client";

import { useState } from "react";

type InitialProfile = {
  publicNameMode?: "anonymous" | "nickname";
  publicNickname?: string | null;
};

export default function ProfileSetup({ initialProfile }: { initialProfile?: InitialProfile }) {
  const [publicNameMode, setPublicNameMode] = useState<"anonymous" | "nickname">(
    initialProfile?.publicNameMode === "nickname" ? "nickname" : "anonymous",
  );
  const [publicNickname, setPublicNickname] = useState(initialProfile?.publicNickname ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicNameMode, publicNickname }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setSaving(false);
    setMessage(result.message ?? result.error ?? "暂时无法保存。");
  };

  return (
    <form className="profile-setup" onSubmit={submit}>
      <div className="profile-setup-heading">
        <span>PUBLIC IDENTITY</span>
        <h2>公开身份</h2>
        <p>交易通过站内匿名聊天完成，不需要填写电话、微信或 QQ。</p>
      </div>
      <fieldset className="public-identity-fieldset">
        <legend>商品与聊天中如何显示你</legend>
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
        <p>Google 姓名、登录邮箱和学术邮箱不会在商品页或聊天中向对方公开。</p>
      </fieldset>
      <div className="profile-setup-actions">
        <small>{message || "默认使用匿名身份，可随时改为昵称。"}</small>
        <button type="submit" disabled={saving}>{saving ? "保存中…" : "保存设置"}</button>
      </div>
    </form>
  );
}
