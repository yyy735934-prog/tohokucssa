"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [showButton, setShowButton] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const userAgent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const setupFrame = window.requestAnimationFrame(() => {
      setPlatform(ios ? "ios" : android ? "android" : "other");
      setShowButton(!standalone && (ios || android));
    });

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setShowButton(true);
    };
    const installed = () => { setPromptEvent(null); setShowButton(false); setShowGuide(false); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.cancelAnimationFrame(setupFrame);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "accepted") setShowButton(false);
      return;
    }
    setShowGuide(true);
  };

  if (!showButton) return null;
  return (
    <>
      <button className="pwa-install-button" type="button" onClick={() => void install()}><span>⇩</span> 安装到桌面</button>
      {showGuide && <div className="pwa-guide-backdrop" role="presentation" onClick={() => setShowGuide(false)}>
        <section className="pwa-guide" role="dialog" aria-modal="true" aria-label="安装东北集市" onClick={(event) => event.stopPropagation()}>
          <button className="pwa-guide-close" type="button" aria-label="关闭" onClick={() => setShowGuide(false)}>×</button>
          <span className="brand-mark">东</span>
          <h2>把东北集市放到桌面</h2>
          {platform === "ios" ? <ol><li>点击浏览器底部的“分享”按钮 <b>□↑</b></li><li>向下滑动，选择“添加到主屏幕”</li><li>点击右上角“添加”完成</li></ol> : <ol><li>请使用 Chrome 等系统浏览器打开本页</li><li>点击浏览器菜单</li><li>选择“安装应用”或“添加到主屏幕”</li></ol>}
          <p>{platform === "ios" ? "iPhone 和 iPad 暂不支持网页直接弹出安装确认，因此需要按以上步骤操作。" : "出现系统安装条件后，此按钮会直接打开安装确认。"}</p>
        </section>
      </div>}
    </>
  );
}
