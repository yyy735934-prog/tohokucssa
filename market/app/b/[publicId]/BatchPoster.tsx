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
  const [qr, setQr] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void QRCode.toDataURL(window.location.href, { width: 360, margin: 1, color: { dark: "#193d31", light: "#ffffff" } }).then(setQr);
  }, []);

  const download = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#f3f0e5" });
      const link = document.createElement("a");
      link.download = `${title.replace(/[\\/:*?"<>|]/g, "-") || "东北集市批次"}.png`;
      link.href = dataUrl;
      link.click();
    } finally { setDownloading(false); }
  };

  return (
    <div className="poster-panel">
      <div className="batch-poster-scale">
        <div className={`batch-poster poster-count-${items.length}`} ref={posterRef}>
          <div className="poster-topline"><b>东北集市</b><span>TOHOKU STUDENT MARKET</span></div>
          <div className="poster-seller"><b>{sellerName}</b>{sellerVerified && <em>✓ 学友身份已认证</em>}<span>⌖ {place}</span></div>
          <div className="poster-item-grid">
            {items.map((item) => (
              <article key={item.id}>
                <div className="poster-item-photo">
                  {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="330px" unoptimized /> : <span>{item.icon}</span>}
                  {item.status !== "active" && <small>{item.status === "sold" ? "已售出" : "审核中"}</small>}
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
      <button className="poster-download" type="button" disabled={!qr || downloading} onClick={() => void download()}>
        {downloading ? "正在生成高清海报…" : "↓ 下载高清海报 PNG"}
      </button>
      <p>审核期间也可以下载转发；网页会同步显示最新审核和售出状态。</p>
    </div>
  );
}
