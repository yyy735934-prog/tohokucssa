"use client";
/* html-to-image needs plain img elements so the poster clone includes pixels and data-URL QR codes. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { compactShareText, listingShareTitle, listingShareUrl, type ShareListing } from "../../../lib/listing-share";

export default function ShareButton({ listing, compact = false }: { listing: ShareListing; compact?: boolean }) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [qr, setQr] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [isWechat, setIsWechat] = useState(false);
  const show = async () => { setIsWechat(/MicroMessenger/i.test(navigator.userAgent)); setOpen(true); if (!qr) setQr(await QRCode.toDataURL(listingShareUrl(listing.id), { width: 640, margin: 2, errorCorrectionLevel: "H", color: { dark: "#17352d", light: "#ffffff" } })); };
  const createPoster = async () => {
    if (!posterRef.current || !qr) throw new Error("POSTER_NOT_READY");
    await document.fonts.ready;
    const image = posterRef.current.querySelector("img.item-share-photo");
    if (image && !image.complete) await new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); });
    const renderedWidth = posterRef.current.getBoundingClientRect().width;
    if (!renderedWidth) throw new Error("POSTER_NOT_VISIBLE");
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 1800 / renderedWidth, cacheBust: true, backgroundColor: "#f3f0e5" });
    const blob = await fetch(dataUrl).then((response) => response.blob());
    return new File([blob], `${listing.title.replace(/[\\/:*?"<>|]/g, "-") || "东北集市商品海报"}.png`, { type: "image/png" });
  };
  const saveFile = (file: File) => { const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const downloadPoster = async () => { setBusy(true); setNotice(""); try { saveFile(await createPoster()); setNotice("高清海报已保存，可发送到微信群。"); } catch { setNotice("海报生成失败，请稍后重试。"); } finally { setBusy(false); } };
  const sharePoster = async () => { setBusy(true); setNotice(""); try { const file = await createPoster(); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: listingShareTitle(listing) }); else { saveFile(file); setNotice("当前浏览器不能直接分享图片，已下载高清海报，请在微信中发送。"); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("暂时无法分享，请使用“下载海报”。"); } finally { setBusy(false); } };
  const shareCard = async () => { if (!navigator.share) { setNotice("请复制浏览器地址到微信，微信会读取商品卡片信息。"); return; } try { await navigator.share({ title: listingShareTitle(listing), url: listingShareUrl(listing.id) }); } catch { /* user cancelled */ } };
  return <>
    <button className={compact ? "share-trigger compact" : "share-trigger"} type="button" aria-label="分享商品" title="分享商品" onClick={() => void show()}><span aria-hidden="true">↗</span>{!compact && " 分享商品"}</button>
    {open && <div className="share-backdrop" role="presentation" onClick={() => setOpen(false)}><section className="share-sheet poster-share-sheet" role="dialog" aria-modal="true" aria-label="分享商品海报" onClick={(event) => event.stopPropagation()}>
      <button className="share-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button><span>SHARE POSTER</span><h2>分享商品海报</h2>
      {isWechat && <aside>微信内无法自动选择群聊。请先保存海报，再作为图片发送到朋友或微信群。</aside>}
      <div className="item-share-poster-frame"><div className="item-share-poster" ref={posterRef}><header><b>东北集市</b><span>TOHOKU STUDENT MARKET</span></header><div className="item-share-visual">{listing.imageUrl ? <img className="item-share-photo" src={listing.imageUrl} alt="" /> : <div>{listing.icon ?? "📦"}</div>}</div><main><span>{listing.category} · {listing.status === "sold" ? "✓ 已找到新主人" : "好物分享"}</span><h3>{listing.title}</h3><strong>{listing.price === 0 ? "免费赠送" : `¥${listing.price.toLocaleString("zh-CN")}`}</strong><p>{compactShareText(listing.description, 90)}</p></main><footer><div><b>⌖ {listing.place}</b><span>扫码查看图片、详情与实时状态</span></div>{qr ? <img src={qr} alt="商品详情二维码" /> : <i />}</footer></div></div>
      <div className="share-options"><button disabled={busy || !qr} onClick={() => void sharePoster()}>{busy ? "正在生成高清海报…" : "分享海报"}</button><button disabled={busy || !qr} onClick={() => void downloadPoster()}>下载海报</button><button className="share-card-option" onClick={() => void shareCard()}>分享链接卡片</button></div>{notice && <p className="share-notice" role="status">{notice}</p>}
    </section></div>}
  </>;
}
