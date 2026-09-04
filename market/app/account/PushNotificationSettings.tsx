"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

export default function PushNotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (!available) return;
    void navigator.serviceWorker.register("/sw.js").then((registration) => registration.pushManager.getSubscription()).then((subscription) => setEnabled(Boolean(subscription)));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("请在浏览器设置中允许东北集市发送通知。");
      const registration = await navigator.serviceWorker.ready;
      const configResponse = await fetch("/api/push");
      const config = await configResponse.json() as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error ?? "消息通知尚未配置。");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("保存通知设置失败，请稍后重试。");
      setEnabled(true);
      setMessage("已开启：审核结果、新联系申请和联络处理结果会发送到本设备。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "开启通知失败，请稍后重试。");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("已关闭本设备的消息通知。");
    } finally { setBusy(false); }
  };

  if (!supported) return (
    <section className="identity-panel push-settings"><div><span className="portal-kicker">消息通知</span><h2>此浏览器暂不支持 Web Push</h2><p>仍可通过邮件和个人中心接收信息；也可改用新版 Chrome，iPhone 请先将网站添加到主屏幕。</p></div></section>
  );

  return (
    <section className="identity-panel push-settings">
      <div><span className="portal-kicker">消息通知</span><h2>{enabled ? "本设备已开启通知" : "在本设备开启消息通知"}</h2><p>及时接收商品审核、联系申请和联络通过等必要信息。通知按设备单独设置。</p></div>
      <button className="portal-primary" type="button" disabled={busy} onClick={() => void (enabled ? disable() : enable())}>{busy ? "处理中…" : enabled ? "关闭通知" : "开启通知"}</button>
      {message && <p className="form-notice" role="status">{message}</p>}
    </section>
  );
}
