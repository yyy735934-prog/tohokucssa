"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  inferListingIntelligence,
  LISTING_CATEGORIES,
  type ListingCategory,
} from "../lib/listing-intelligence";
import { matchesMarketSearch } from "../lib/market-search";
import ProfileSetup from "./ProfileSetup";
import PublishLocationMap, { type PublishLocation } from "./PublishLocationMap";
import PwaInstallPrompt from "./PwaInstallPrompt";
import MobileNav from "./MobileNav";

type Viewer = {
  displayName: string;
  email: string;
  profileCompleted: boolean;
} | null;

type MarketItem = {
  id: string;
  title: string;
  price: number;
  category: string;
  place: string;
  time: string;
  seller: string;
  sellerVerified: boolean;
  badge: string;
  icon: string;
  tone: string;
  note: string;
  status?: string;
  imageUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string;
  isOwner?: boolean;
};

type ContactStatus = "pending" | "accepted" | "declined";

const categories = ["全部", ...LISTING_CATEGORIES];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 60_000,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function compressListingPhoto(file: File) {
  if (file.size <= 1_200_000) return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1440 / maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("IMAGE_PROCESSING_FAILED");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let compressed: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.58]) {
    compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (compressed && compressed.size <= 1_500_000) break;
  }
  if (!compressed) throw new Error("IMAGE_PROCESSING_FAILED");

  const basename = file.name.replace(/\.[^.]+$/, "") || "listing-photo";
  return new File([compressed], `${basename}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function HomeClient({ viewer, chatEnabled = false }: { viewer: Viewer; chatEnabled?: boolean }) {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [publicationMessage, setPublicationMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [publishStep, setPublishStep] = useState(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoImageKey, setPhotoImageKey] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState<ListingCategory>("其他");
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [itemIcon, setItemIcon] = useState("📦");
  const [aiMessage, setAiMessage] = useState("");
  const [pickup, setPickup] = useState("");
  const [publishLocation, setPublishLocation] = useState<PublishLocation | null>(null);
  const [price, setPrice] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [contactStatuses, setContactStatuses] = useState<Record<string, ContactStatus>>({});
  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(Boolean(viewer?.profileCompleted));
  const [showProfileSetup, setShowProfileSetup] = useState(Boolean(viewer && !viewer.profileCompleted));
  const [pushPromptListingId, setPushPromptListingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/listings")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { listings?: MarketItem[] };
      })
      .then((result) => {
        if (active && result?.listings) {
          setItems(result.listings);
          const listingId = new URLSearchParams(window.location.search).get("listing");
          const matched = listingId ? result.listings.find((item) => item.id === listingId) : null;
          if (matched) setSelectedItem(matched);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!viewer) return;
    fetch("/api/favorites")
      .then(async (response) => response.ok ? (await response.json()) as { listings?: MarketItem[] } : null)
      .then((result) => { if (result?.listings) setFavorites(result.listings.map((item) => item.id)); })
      .catch(() => undefined);
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    fetch("/api/contacts")
      .then(async (response) => response.ok ? (await response.json()) as {
        requests?: Array<{ listingId: string; status: ContactStatus }>;
        pendingIncoming?: number;
      } : null)
      .then((result) => {
        if (!result) return;
        setContactStatuses(Object.fromEntries(
          (result.requests ?? []).map((contact) => [contact.listingId, contact.status]),
        ));
        setPendingIncoming(result.pendingIncoming ?? 0);
      })
      .catch(() => undefined);
  }, [viewer]);

  const filtered = useMemo(() => items.filter((item) =>
    (category === "全部" || item.category === category) &&
    matchesMarketSearch(item, query)
  ), [items, query, category]);

  const toggleFavorite = async (id: string) => {
    if (!viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F");
      return;
    }
    const isSaved = favorites.includes(id);
    setFavorites((current) => isSaved ? current.filter((itemId) => itemId !== id) : [...current, id]);
    const response = await fetch(
      isSaved ? `/api/favorites?listingId=${encodeURIComponent(id)}` : "/api/favorites",
      isSaved ? { method: "DELETE" } : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      },
    );
    if (!response.ok) {
      setFavorites((current) => isSaved ? [...current, id] : current.filter((itemId) => itemId !== id));
      showNotice("收藏操作失败，请稍后再试。");
    }
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const resetPublisher = () => {
    setPublishStep(1);
    setPublished(false);
    setPublicationMessage("");
    setAiLoading(false);
    setPhotoName("");
    setPhotoFile(null);
    setPhotoImageKey(null);
    setItemTitle("");
    setItemDescription("");
    setItemCategory("其他");
    setCategoryManuallySelected(false);
    setItemIcon("📦");
    setAiMessage("");
    setPickup("");
    setPublishLocation(null);
    setPrice("");
  };

  const openPublisher = () => {
    resetPublisher();
    setPublishOpen(true);
  };

  const closePublisher = () => {
    setPublishOpen(false);
    resetPublisher();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("publish") !== "1") return;
    const timer = window.setTimeout(() => {
      setPublishOpen(true);
      params.delete("publish");
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submitListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F");
      return;
    }
    setPublishing(true);
    try {
      let imageKey = photoImageKey;
      if (photoFile && !imageKey) {
        setNotice(photoFile.size > 1_200_000 ? "正在优化照片并上传…" : "正在上传照片…");
        const uploadFile = await compressListingPhoto(photoFile);
        const form = new FormData();
        form.append("image", uploadFile);
        const uploadResponse = await fetchWithTimeout(
          "/api/uploads",
          { method: "POST", body: form },
        );
        const uploadResult = await readJson<{ key?: string; error?: string }>(uploadResponse);
        if (!uploadResponse.ok || !uploadResult?.key) {
          showNotice(
            uploadResponse.status === 413
              ? "照片仍然过大，请换一张照片后重试。"
              : uploadResult?.error ?? "照片上传失败，请稍后再试。",
          );
          return;
        }
        imageKey = uploadResult.key;
      }
      setNotice("正在提交商品信息…");
      const response = await fetchWithTimeout("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: itemTitle,
          description: itemDescription,
          price: Number(price),
          place: pickup,
          lat: publishLocation?.lat,
          lng: publishLocation?.lng,
          imageKey,
          category: itemCategory,
        }),
      });
      const result = await readJson<{ error?: string; message?: string; listing?: MarketItem }>(response);
      if (response.status === 401) {
        window.location.assign("/signin-with-chatgpt?return_to=%2F");
        return;
      }
      if (!response.ok || !result) {
        showNotice(result?.error ?? "发布失败，请稍后再试。");
        return;
      }
      if (result.listing?.status === "active") {
        setItems((current) => [result.listing!, ...current]);
      }
      setPublished(true);
      setPublicationMessage(result.message ?? "商品信息已提交。");
      setNotice(result.message ?? "已提交审核。");
    } catch (error) {
      showNotice(
        error instanceof DOMException && error.name === "AbortError"
          ? "上传超时，请检查网络后重试。"
          : "提交未完成，请重试；已填写的内容不会丢失。",
      );
    } finally {
      setPublishing(false);
    }
  };

  const requestContact = async (listingId: string) => {
    if (!viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F");
      return;
    }
    if (contactStatuses[listingId]) {
      window.location.assign("/account#contacts");
      return;
    }
    if (!profileReady) {
      setShowProfileSetup(true);
      showNotice("请先留下至少一种联系方式。");
      return;
    }

    setContactingId(listingId);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const result = await readJson<{
        code?: string;
        error?: string;
        message?: string;
        contact?: { status?: ContactStatus };
      }>(response);
      if (response.status === 401) {
        window.location.assign("/signin-with-chatgpt?return_to=%2F");
        return;
      }
      if (result?.code === "CONTACT_PROFILE_REQUIRED") {
        setProfileReady(false);
        setShowProfileSetup(true);
      }
      if (response.ok && result?.contact?.status) {
        setContactStatuses((current) => ({
          ...current,
          [listingId]: result.contact!.status!,
        }));
      }
      showNotice(result?.message ?? result?.error ?? "暂时无法发送联系申请。");
    } catch {
      showNotice("联系申请发送失败，请检查网络后重试。");
    } finally {
      setContactingId(null);
    }
  };

  const openChat = async (listingId: string, skipPushPrompt = false) => {
    if (!viewer) {
      window.location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent(`/?listing=${listingId}`)}`);
      return;
    }
    if (!chatEnabled) { await requestContact(listingId); return; }
    if (!skipPushPrompt && "Notification" in window && Notification.permission === "default") {
      const dismissedAt = Number(localStorage.getItem("chat-push-prompt-dismissed-at") || 0);
      if (Date.now() - dismissedAt > 30 * 24 * 60 * 60 * 1000) { setPushPromptListingId(listingId); return; }
    }
    setContactingId(listingId);
    try {
      const response = await fetch("/api/chat/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId }) });
      const result = await readJson<{ id?: string; error?: string }>(response);
      if (response.status === 401) { window.location.assign("/signin-with-chatgpt?return_to=%2F"); return; }
      if (!response.ok || !result?.id) throw new Error(result?.error || "暂时无法开始聊天。");
      window.location.assign(`/messages/${result.id}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "暂时无法开始聊天。");
      setContactingId(null);
    }
  };

  const decidePushPrompt = async (enable: boolean) => {
    const listingId = pushPromptListingId;
    setPushPromptListingId(null);
    if (!listingId) return;
    if (!enable) localStorage.setItem("chat-push-prompt-dismissed-at", String(Date.now()));
    if (enable && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.register("/sw.js");
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            const configResponse = await fetch("/api/push");
            const config = await configResponse.json() as { publicKey?: string };
            if (config.publicKey) {
              const padding = "=".repeat((4 - config.publicKey.length % 4) % 4);
              const raw = (config.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
              const key = Uint8Array.from(atob(raw), (character) => character.charCodeAt(0));
              subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            }
          }
          if (subscription) await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        }
      } catch { /* 通知是可选项，失败不阻断聊天 */ }
    }
    await openChat(listingId, true);
  };

  const updateItemIntelligence = (
    title: string,
    description: string,
    preferredCategory?: ListingCategory,
  ) => {
    const visual = inferListingIntelligence(
      title,
      description,
      preferredCategory ?? (categoryManuallySelected ? itemCategory : undefined),
    );
    setItemCategory(visual.category);
    setItemIcon(visual.icon);
  };

  const runAiScan = async (file?: File) => {
    if (file && !viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F%3Fpublish%3D1");
      return;
    }
    setPhotoName(file?.name ?? "IMG_2026_0723.jpg");
    setPhotoFile(file ?? null);
    setPhotoImageKey(null);
    setCategoryManuallySelected(false);
    setPublishStep(2);
    setAiLoading(true);
    setAiMessage("");

    if (!file) {
      window.setTimeout(() => {
        const title = "复古植物装饰画";
        const description = "适合书房或客厅装饰，画框与画面状态请发布前再次核对。";
        const visual = inferListingIntelligence(title, description);
        setItemTitle(title);
        setItemDescription(description);
        setItemCategory(visual.category);
        setItemIcon(visual.icon);
        setAiMessage("✦ AI 已自动识别，可直接修改");
        setAiLoading(false);
      }, 850);
      return;
    }

    try {
      const uploadFile = await compressListingPhoto(file);
      const uploadForm = new FormData();
      uploadForm.append("image", uploadFile);
      const uploadResponse = await fetchWithTimeout(
        "/api/uploads",
        { method: "POST", body: uploadForm },
      );
      const uploadResult = await readJson<{ key?: string; error?: string }>(uploadResponse);
      if (!uploadResponse.ok || !uploadResult?.key) {
        setItemTitle("");
        setItemDescription("");
        updateItemIntelligence("", "");
        setAiMessage(uploadResult?.error ?? "照片上传失败，请重新选择或稍后再试。");
        return;
      }
      setPhotoImageKey(uploadResult.key);
      const form = new FormData();
      form.append("image", uploadFile);
      form.append("imageKey", uploadResult.key);
      const response = await fetchWithTimeout(
        "/api/ai/listing",
        { method: "POST", body: form },
        45_000,
      );
      const result = await readJson<{
        title?: string;
        description?: string;
        category?: ListingCategory;
        icon?: string;
        error?: string;
      }>(response);
      if (response.status === 401) {
        window.location.assign("/signin-with-chatgpt?return_to=%2F%3Fpublish%3D1");
        return;
      }
      if (!response.ok || !result?.title || !result.description) {
        setItemTitle("");
        setItemDescription("");
        updateItemIntelligence("", "");
        setAiMessage(result?.error ?? "暂时无法识别，请手动填写商品名称。");
        return;
      }
      setItemTitle(result.title);
      setItemDescription(result.description);
      updateItemIntelligence(result.title, result.description, result.category);
      setAiMessage("✦ AI 已自动识别，可直接修改");
    } catch (error) {
      setItemTitle("");
      setItemDescription("");
      updateItemIntelligence("", "");
      setAiMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "识别超时，请手动填写商品名称。"
          : "暂时无法识别，请手动填写商品名称。",
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="东北集市首页">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>学友会二手平台</small></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          <a className="active" href="#market">逛集市</a>
          <a href="/map">二手地图</a>
          <a href="#guide">交易指南</a>
          <a href="#about">关于平台</a>
        </nav>
        <div className="top-actions">
          <PwaInstallPrompt />
          <button
            className="circle-btn message-button"
            aria-label={pendingIncoming ? `${pendingIncoming} 条待处理联系申请` : "交易联系"}
            onClick={() => window.location.assign(viewer ? (chatEnabled ? "/messages" : "/account#contacts") : "/signin-with-chatgpt?return_to=%2Fmessages")}
          >
            <Icon>♢</Icon>
            {pendingIncoming > 0 && <b className="message-badge">{Math.min(pendingIncoming, 9)}</b>}
          </button>
          <a className="profile-btn" href={viewer ? "/account" : "/signin-with-chatgpt?return_to=%2Faccount"}>
            <span>{viewer ? viewer.displayName.slice(0, 1).toUpperCase() : "登"}</span>
            <b>{viewer ? "我的" : "登录 / 注册"}</b>
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>●</span> 东北地区中国留学生专属</div>
          <h1>闲置有新主，<br /><em>同学少绕路。</em></h1>
          <p>让搬家更轻松，让好物在仙台继续生活。实名认证、校内交接，买卖都更安心。</p>
          <div className="hero-actions" aria-label="买卖快捷入口">
            <section className="hero-action find-action">
              <div className="action-label"><span>⌕</span><div><b>我要淘闲置</b><small>搜一搜同学正在出的好物</small></div></div>
              <div className="search-box">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="自行车、电饭煲、教材……" aria-label="搜索闲置物品" />
                <button onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })} aria-label="搜索商品">→</button>
              </div>
            </section>
            <section className="hero-action sell-action">
              <div className="action-label"><span>＋</span><div><b>我要出闲置</b><small>拍张照片，AI 帮你完成发布</small></div></div>
              <div className="sell-publish-actions">
                <button className="quick-publish" onClick={openPublisher}>
                  <span>▣</span><span><b>拍照发布</b><small>发布单件物品</small></span>
                </button>
                <a className="batch-publish-link" href={viewer ? "/batch/new" : "/signin-with-chatgpt?return_to=%2Fbatch%2Fnew"}>
                  <span>▦</span><span><b>批量发布</b><small>多件物品并生成海报</small></span>
                </a>
              </div>
            </section>
          </div>
          <div className="hero-links"><span>大家在搜</span><button onClick={() => setQuery("自行车")}>自行车</button><button onClick={() => setQuery("电饭煲")}>电饭煲</button><button onClick={() => setCategory("家具")}>家具</button></div>
        </div>
        <div className="hero-art" aria-label="校园物品循环插画">
          <div className="sun"></div>
          <div className="cloud cloud-one"></div>
          <div className="cloud cloud-two"></div>
          <div className="hill hill-back"></div>
          <div className="hill hill-front"></div>
          <div className="art-card art-bike"><span>🚲</span><small>通学好物</small></div>
          <div className="art-card art-lamp"><span>💡</span><small>新家必备</small></div>
          <div className="art-card art-book"><span>📚</span><small>知识接力</small></div>
          <div className="art-seal">循环<br />生活</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="平台特点">
        <div><Icon>✓</Icon><span><b>学友身份</b><small>同校同城，更可信</small></span></div>
        <div><Icon>⌖</Icon><span><b>就近交接</b><small>校园与地铁站面交</small></span></div>
        <div><Icon>↻</Icon><span><b>物尽其用</b><small>少一点浪费，多一点连接</small></span></div>
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><span className="kicker">JUST IN</span><h2>刚刚上新</h2><p>看看同学们今天分享了什么</p></div>
          <button className="view-all">查看全部 <span>→</span></button>
        </div>
        <div className="filters" role="group" aria-label="商品分类">
          {categories.map((cat) => <button key={cat} className={category === cat ? "selected" : ""} onClick={() => setCategory(cat)}>{cat}</button>)}
        </div>
        <div className="item-grid">
          {filtered.map((item) => (
            <article className="item-card" data-testid={`item-${item.id}`} key={item.id} role="button" tabIndex={0} onClick={() => setSelectedItem(item)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(item); }}>
              <div className={`item-photo ${item.tone}`}>{item.imageUrl ? <Image className="listing-image" src={item.imageUrl} alt={item.title} fill sizes="(max-width: 620px) 50vw, 33vw" unoptimized /> : <span>{item.icon}</span>}<label>{item.badge}</label><button className={favorites.includes(item.id) ? "favorited" : ""} aria-label={`收藏${item.title}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}>{favorites.includes(item.id) ? "♥" : "♡"}</button></div>
              <div className="item-info">
                <h3>{item.title}</h3>
                <div className="price">{item.price === 0 ? "免费" : <>¥{item.price.toLocaleString()}</>}</div>
                <div className="meta"><span>⌖ {item.place}</span><span>{item.time}</span></div>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div className="empty"><span>🪴</span><h3>暂时没有找到</h3><p>换个关键词看看，或者发布求购信息。</p></div>}
      </section>

      <section className="guide-section" id="guide">
        <div className="guide-copy">
          <span className="kicker">SAFE & SIMPLE</span>
          <h2>拍张照片，剩下的交给 AI</h2>
          <p>AI 自动识别物品并生成描述，你只需确认交接地点和价格，最快一分钟即可发布。</p>
          <button onClick={openPublisher}>现在发布闲置 <span>→</span></button>
        </div>
        <div className="steps four-steps">
          <article><b>01</b><span>拍照</span><small>上传一张物品实拍</small></article>
          <article><b>02</b><span>AI 识别</span><small>自动生成标题与描述</small></article>
          <article><b>03</b><span>选地点</span><small>选择方便的交接区域</small></article>
          <article><b>04</b><span>定价发布</span><small>确认价格，一键发布</small></article>
        </div>
      </section>

      <footer id="about">
        <div className="footer-brand"><span className="brand-mark">东</span><div><b>东北集市</b><small>让闲置流动，让同学连接</small></div></div>
        <p>由東北地区中国留学生学友会发起</p>
        <div><a href="/policies/terms">使用规范</a><a href="/policies/report">举报与建议</a><a href="/policies/privacy">隐私说明</a></div>
      </footer>

      <MobileNav active="home" homeHref="#top" viewer={Boolean(viewer)} chatEnabled={chatEnabled} onPublish={openPublisher} />
      <button className="mobile-publish" onClick={openPublisher}>＋ 发布闲置</button>

      {selectedItem && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedItem(null)}>
        <section className="detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedItem.title}详情`} onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" aria-label="关闭商品详情" onClick={() => setSelectedItem(null)}>×</button>
          <div className={`detail-photo ${selectedItem.tone}`}>{selectedItem.imageUrl ? <Image className="listing-image" src={selectedItem.imageUrl} alt={selectedItem.title} fill sizes="50vw" unoptimized /> : <span>{selectedItem.icon}</span>}<label>{selectedItem.badge}</label></div>
          <div className="detail-content">
            <span className="detail-category">{selectedItem.category} · {selectedItem.time}</span>
            <h2>{selectedItem.title}</h2>
            <div className="detail-price">{selectedItem.price === 0 ? "免费赠送" : `¥${selectedItem.price.toLocaleString()}`}</div>
            <p>{selectedItem.note}</p>
            <div className="seller-row"><span>{selectedItem.seller.slice(0,1)}</span><div><b>{selectedItem.seller}</b><small>{selectedItem.sellerVerified ? "✓ 已认证学友" : "身份待核验"} · 通常1小时内回复</small></div></div>
            <div className="pickup">⌖ 建议交接地点 <b>{selectedItem.place}附近公共场所</b></div>
            <div className="detail-actions">
              <button className={favorites.includes(selectedItem.id) ? "favorited" : ""} onClick={() => toggleFavorite(selectedItem.id)}>{favorites.includes(selectedItem.id) ? "♥ 已收藏" : "♡ 收藏"}</button>
              <button disabled={selectedItem.isOwner || contactingId === selectedItem.id} onClick={() => void openChat(selectedItem.id)}>
                {selectedItem.isOwner
                  ? "这是你的商品"
                  : contactingId === selectedItem.id
                  ? chatEnabled ? "正在连接…" : "正在发送…"
                  : chatEnabled
                    ? "联系卖家"
                    : contactStatuses[selectedItem.id] === "accepted"
                    ? "查看联系方式"
                    : contactStatuses[selectedItem.id] === "declined"
                      ? "查看申请结果"
                      : contactStatuses[selectedItem.id] === "pending"
                        ? "申请已发送"
                        : "联系卖家"}
              </button>
            </div>
            <small className="safety-note">请勿提前转账；当面验货确认后再完成交易。</small>
          </div>
        </section>
      </div>}

      {pushPromptListingId && <div className="push-soft-backdrop" role="presentation" onClick={() => void decidePushPrompt(false)}>
        <section className="push-soft-dialog" role="dialog" aria-modal="true" aria-label="开启新消息通知" onClick={(event) => event.stopPropagation()}>
          <span>◇</span><h2>及时收到卖家回复</h2>
          <p>开启通知后，即使没有停留在聊天页面，也能收到匿名交易消息。你也可以稍后在个人中心开启。</p>
          <div><button type="button" onClick={() => void decidePushPrompt(false)}>暂不开启</button><button type="button" onClick={() => void decidePushPrompt(true)}>开启通知并聊天</button></div>
        </section>
      </div>}

      {publishOpen && <div className="modal-backdrop publish-backdrop" role="presentation" onClick={closePublisher}>
        <section className="publish-modal" role="dialog" aria-modal="true" aria-label="发布闲置" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" aria-label="关闭发布窗口" onClick={closePublisher}>×</button>
          {published ? <div className="publish-success"><span>✓</span><h2>提交成功</h2><p>{publicationMessage} 之后可以在“我的发布”中查看状态或标记为已出。</p><button onClick={closePublisher}>完成</button></div> : <>
            <div className="wizard-header">
              <div className="modal-title"><span className="kicker">AI QUICK LISTING</span><h2>发布闲置</h2></div>
              <ol className="wizard-steps" aria-label="发布进度">
                {["拍照", "AI识别", "交接地点", "定价发布"].map((label, index) => <li key={label} className={publishStep === index + 1 ? "current" : publishStep > index + 1 ? "done" : ""}><span>{publishStep > index + 1 ? "✓" : index + 1}</span><b>{label}</b></li>)}
              </ol>
            </div>

            {publishStep === 1 && <section className="wizard-pane photo-step">
              <label className="ai-upload">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) runAiScan(file); }} />
                <span className="camera-icon">▣</span>
                <b>拍照或选择照片</b>
                <small>尽量拍清物品全貌，光线明亮即可</small>
              </label>
              <div className="step-copy"><span>第 1 步</span><h3>只需先拍一张照片</h3><p>上传后，AI 会自动识别物品、判断分类，并生成可以直接使用的标题和描述。</p><button type="button" className="demo-photo" onClick={() => runAiScan()}>使用示例照片体验 →</button></div>
            </section>}

            {publishStep === 2 && <section className="wizard-pane ai-step">
              {aiLoading ? <div className="ai-loading"><span></span><b>AI 正在识别物品…</b><small>正在分析品类、品牌与外观状态</small></div> : <>
                <div className="ai-preview"><span>{itemIcon}</span><small>{photoName}</small><b>{itemCategory} · 自动匹配</b></div>
                <div className="ai-fields">
                  <div className="ai-badge">{aiMessage || "填写商品名称后，将自动匹配栏目与地图图标"}</div>
                  <div className="ai-result-meta"><span>{itemIcon}</span><div><b>{itemCategory}</b><small>AI 已推荐栏目，你也可以自行更改</small></div></div>
                  <label><span>商品名称</span><input aria-label="商品名称" required value={itemTitle} placeholder="例如：宜家书桌、山地自行车" onChange={(e) => { const value = e.target.value; setItemTitle(value); updateItemIntelligence(value, itemDescription); }} /></label>
                  <label><span>商品描述</span><textarea aria-label="商品描述" required value={itemDescription} placeholder="简要说明成色、功能和配件" onChange={(e) => { const value = e.target.value; setItemDescription(value); updateItemIntelligence(itemTitle, value); }} /></label>
                  <label><span>商品栏目</span><select aria-label="商品栏目" value={itemCategory} onChange={(event) => { const value = event.target.value as ListingCategory; setCategoryManuallySelected(true); setItemCategory(value); updateItemIntelligence(itemTitle, itemDescription, value); }}>{LISTING_CATEGORIES.map((listingCategory) => <option key={listingCategory} value={listingCategory}>{listingCategory}</option>)}</select></label>
                  <div className="wizard-actions"><button type="button" className="back-button" onClick={() => setPublishStep(1)}>重拍</button><button type="button" onClick={() => setPublishStep(3)} disabled={!itemTitle.trim() || !itemDescription.trim()}>内容没问题，下一步 →</button></div>
                </div>
              </>}
            </section>}

            {publishStep === 3 && <section className="wizard-pane location-step">
              <div className="step-copy"><span>第 3 步</span><h3>在哪里方便交接？</h3><p>只展示大致区域。具体时间和地点请与买家私下确认，建议选择校园或车站等公共场所。</p></div>
              <div className="location-picker map-location-picker" role="group" aria-label="选择交接地点">
                <PublishLocationMap
                  value={publishLocation}
                  onChange={(location) => {
                    setPublishLocation(location);
                    if (!pickup) setPickup(location.label);
                  }}
                />
                <label className="location-name-field">
                  <span>地点名称</span>
                  <input aria-label="交易地点名称" placeholder="例如：川内站南口" value={pickup} onChange={(event) => setPickup(event.target.value)} />
                  <small>公开页面只显示名称与地图标记；具体交接细节请私下确认。</small>
                </label>
                {publishLocation && <div className="selected-coordinate">✓ 已标记：{publishLocation.lat.toFixed(4)}, {publishLocation.lng.toFixed(4)}</div>}
                <div className="wizard-actions wide"><button type="button" className="back-button" onClick={() => setPublishStep(2)}>上一步</button><button type="button" onClick={() => setPublishStep(4)} disabled={!pickup || !publishLocation}>选好了，下一步 →</button></div>
              </div>
            </section>}

            {publishStep === 4 && <form className="wizard-pane price-step" onSubmit={submitListing}>
              <div className="listing-summary"><div className="summary-photo">{itemIcon}</div><div><span>{itemCategory} · 即将发布</span><h3>{itemTitle}</h3><p>⌖ {pickup}交接</p></div></div>
              <div className="pricing-box">
                <label><span>你的价格</span><div className="price-input"><b>¥</b><input aria-label="商品价格" type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></div></label>
                <div className="price-chips"><span>请根据物品成色自行定价</span><button type="button" onClick={() => setPrice("0")}>设为免费赠送</button></div>
                <div className="wizard-actions"><button type="button" className="back-button" onClick={() => setPublishStep(3)}>上一步</button><button type="submit" disabled={publishing}>{publishing ? "正在提交…" : viewer ? "确认并发布" : "登录后发布"}</button></div>
                <small className="terms">发布即表示你确认信息真实，并同意遵守<a href="/policies/terms" target="_blank">平台交易规范</a>。</small>
              </div>
            </form>}
          </>}
        </section>
      </div>}

      {showProfileSetup && viewer && (
        <div className="modal-backdrop profile-onboarding-backdrop" role="presentation">
          <section className="profile-onboarding-modal" role="dialog" aria-modal="true" aria-label="完善交易联系方式">
            <ProfileSetup onboarding onComplete={() => { setProfileReady(true); setShowProfileSetup(false); }} />
            <button className="profile-skip" onClick={() => setShowProfileSetup(false)}>稍后在个人中心填写</button>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}
