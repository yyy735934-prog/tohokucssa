"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";

export type PosterItem = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  icon: string;
  status: string;
};

const posterStatusText: Record<string, string> = {
  pending: "审核中",
  sold: "已售出",
  withdrawn: "已下架",
  rejected: "未通过",
};

export default function BatchPoster({
  title, sellerName, sellerVerified, place, items,
}: {
  title: string;
  sellerName: string;
  sellerVerified: boolean;
  place: string;
  items: PosterItem[];
}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const shareFileRef = useRef<File | null>(null);
  const [qr, setQr] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [preparingShare, setPreparingShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  const filename = `${title.replace(/[\\/:*?"<>|]/g, "-") || "东北集市海报"}.png`;

  useEffect(() => {
    void QRCode.toDataURL(window.location.href, { width: 360, margin: 1, color: { dark: "#193d31", light: "#ffffff" } }).then(setQr);
  }, []);

  const createPosterFile = async () => {
    if (!posterRef.current) throw new Error("Poster is not ready");
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#f3f0e5" });
    const blob = await fetch(dataUrl).then((response) => response.blob());
    return new File([blob], filename, { type: "image/png" });
  };

  useEffect(() => {
    if (!qr) return;
    let cancelled = false;
    setPreparingShare(true);
    void createPosterFile()
      .then((file) => {
        if (!cancelled) shareFileRef.current = file;
      })
      .catch(() => {
        if (!cancelled) shareFileRef.current = null;
      })
      .finally(() => {
        if (!cancelled) setPreparingShare(false);
      });
    return () => { cancelled = true; };
  }, [qr]);

  const download = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const file = shareFileRef.current ?? await createPosterFile();
      shareFileRef.current = file;
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.download = filename;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } finally { setDownloading(false); }
  };

  const copyPosterLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNotice("当前浏览器未开放系统分享面板，海报链接已复制。");
    } catch {
      setShareNotice("当前浏览器不支持系统分享，请使用下载按钮保存海报后转发。");
    }
  };

  const share = async () => {
    if (!qr || sharing) return;
    if (!navigator.share) {
      await copyPosterLink();
      return;
    }
    setSharing(true);
    setShareNotice("");
    const file = shareFileRef.current;
    const shareTitle = `${title}｜东北集市`;
    const shareText = `${title}，扫码查看商品实时状态与详情。`;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: shareTitle, text: shareText, files: [file] });
      } else {
        await navigator.share({ title: shareTitle, text: shareText, url: window.location.href });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await copyPosterLink();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="poster-panel">
      <div className="batch-poster-scale">
        <div className={`batch-poster poster-count-${items.length}`} ref={posterRef}>
          <div className="poster-topline"><div className="poster-logo"><Image src="/icons/pwa-192.png" alt="" width={40} height={40} /><b>东北集市</b></div><span>TOHOKU STUDENT MARKET</span></div>
          <div className="poster-seller"><b>{sellerName}</b>{sellerVerified && <em>✓ 学友身份已认证</em>}<span>⌖ {place}</span></div>
          <div className="poster-item-grid">
            {items.map((item) => (
              <article key={item.id}>
                <div className="poster-item-photo">
                  {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="330px" unoptimized /> : <span>{item.icon}</span>}
                  {item.status !== "active" && <small>{posterStatusText[item.status] ?? "暂不可用"}</small>}
                </div>
                <h2>{item.title}</h2>
                <strong>{item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`}</strong>
              </article>
            ))}
          </div>
          <footer>
            <div><b>扫码查看实时状态与商品详情</b><span>商品状态以扫码页面为准</span></div>
            {qr ? <Image src={qr} alt="批次网页二维码" width={360} height={360} unoptimized /> : <div className="poster-qr-placeholder" />}
          </footer>
        </div>
      </div>
      <div className="poster-actions">
        <button className="poster-download" type="button" disabled={!qr || downloading} onClick={() => void download()}>
          {downloading ? "正在生成高清海报…" : "↓ 下载高清海报 PNG"}
        </button>
        <button
          className="poster-share"
          type="button"
          disabled={!qr || preparingShare || sharing}
          aria-label="分享或转发海报"
          title="分享或转发海报"
          onClick={() => void share()}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
          <span>{preparingShare ? "准备中" : sharing ? "分享中" : "分享 / 转发"}</span>
        </button>
      </div>
      {shareNotice && <div className="poster-share-notice" role="status">{shareNotice}</div>}
      <p>审核期间也可以下载转发；网页会同步显示最新审核和售出状态。</p>
    </div>
  );
}
