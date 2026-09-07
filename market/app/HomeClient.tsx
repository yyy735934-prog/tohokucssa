"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  inferListingIntelligence,
  LISTING_CATEGORIES,
  type ListingCategory,
} from "../lib/listing-intelligence";
import { matchesMarketSearch } from "../lib/market-search";
import { isRecentPriceReduction, isReducedPrice } from "../lib/listing-price";
import PublishLocationMap, { type PublishLocation } from "./PublishLocationMap";
import PwaInstallPrompt from "./PwaInstallPrompt";
import MobileNav from "./MobileNav";

type Viewer = {
  displayName: string;
  email: string;
} | null;

type MarketItem = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  priceReducedAt?: string | null;
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
  soldAt?: string | null;
  soldTime?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string;
  isOwner?: boolean;
};

const categories = ["全部", ...LISTING_CATEGORIES];

function shuffleMarketItems(items: MarketItem[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }
  const now = Date.now();
  return shuffled.sort((first, second) =>
    Number(isRecentPriceReduction(second.price, second.originalPrice, second.priceReducedAt, now)) -
    Number(isRecentPriceReduction(first.price, first.originalPrice, first.priceReducedAt, now))
  );
}

function ListingPrice({ item, detail = false }: { item: MarketItem; detail?: boolean }) {
  const reduced = isReducedPrice(item.price, item.originalPrice);
  return <div className={detail ? "detail-price listing-sale-price" : `price${reduced ? " listing-sale-price" : ""}`}>
    {reduced && <del>¥{item.originalPrice!.toLocaleString()}</del>}
    <strong>{item.price === 0 ? (detail ? "免费赠送" : "免费") : `¥${item.price.toLocaleString()}`}</strong>
  </div>;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function SoldListingCard({ item }: { item: MarketItem }) {
  return (
    <article className="sold-card">
      <div className={`sold-photo ${item.tone}`}>
        {item.imageUrl
          ? <Image className="listing-image" src={item.imageUrl} alt={item.title} fill sizes="160px" unoptimized />
          : <span>{item.icon}</span>}
        <b>✓ 已找到新主人</b>
      </div>
      <div className="sold-info">
        <h3>{item.title}</h3>
        <strong>{item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`}</strong>
        <small>⌖ {item.place} · {item.soldTime ?? "最近"}</small>
      </div>
    </article>
  );
}

function SoldListingStrip({ items }: { items: MarketItem[] }) {
  return (
    <div className="sold-strip" tabIndex={0} aria-label="最近成交商品，可横向滚动">
      {items.map((item) => <SoldListingCard key={item.id} item={item} />)}
    </div>
  );
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mobilePlatform() {
  if (typeof navigator === "undefined") return "other" as const;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios" as const;
  return /Android/i.test(navigator.userAgent) ? "android" as const : "other" as const;
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
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
  const [recentlySold, setRecentlySold] = useState<MarketItem[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [soldSearchResults, setSoldSearchResults] = useState<MarketItem[]>([]);
  const [soldSearchLoading, setSoldSearchLoading] = useState(false);
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
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [pwaPromptListingId, setPwaPromptListingId] = useState<string | null>(null);
  const [showPwaInstallHelp, setShowPwaInstallHelp] = useState(false);
  const [pushPromptListingId, setPushPromptListingId] = useState<string | null>(null);
  const [pushDeniedListingId, setPushDeniedListingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/listings")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { listings?: MarketItem[]; recentlySold?: MarketItem[]; soldCount?: number };
      })
      .then((result) => {
        if (active && result?.listings) {
          setItems(shuffleMarketItems(result.listings));
          setRecentlySold(result.recentlySold ?? []);
          setSoldCount(Number(result.soldCount ?? 0));
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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      const timer = window.setTimeout(() => {
        setSoldSearchResults([]);
        setSoldSearchLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const loadingTimer = window.setTimeout(() => setSoldSearchLoading(true), 0);
    const timer = window.setTimeout(() => {
      fetch(`/api/listings/history?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
        .then(async (response) => response.ok ? await response.json() as { listings?: MarketItem[] } : null)
        .then((result) => {
          if (!controller.signal.aborted) setSoldSearchResults(result?.listings ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSoldSearchResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSoldSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
        setItems((current) => shuffleMarketItems([...current, result.listing!]));
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

  const openChat = async (listingId: string, skipPushPrompt = false, skipPwaPrompt = false) => {
    if (!viewer) {
      window.location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent(`/?listing=${listingId}`)}`);
      return;
    }
    if (!chatEnabled) { showNotice("聊天服务暂时不可用，请稍后再试。"); return; }
    if (
      !skipPwaPrompt &&
      mobilePlatform() !== "other" &&
      !isStandalonePwa() &&
      localStorage.getItem("chat-pwa-onboarding-seen") !== "1"
    ) {
      setShowPwaInstallHelp(false);
      setPwaPromptListingId(listingId);
      return;
    }
    if (!skipPushPrompt && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
      if (Notification.permission === "denied" && localStorage.getItem("chat-push-denied-explained") !== "1") {
        setPushDeniedListingId(listingId);
        return;
      }
      const dismissedAt = Number(localStorage.getItem("chat-push-prompt-dismissed-at") || 0);
      if (Date.now() - dismissedAt > 30 * 24 * 60 * 60 * 1000) {
        let subscription: PushSubscription | null = null;
        if (Notification.permission === "granted") {
          try {
            const registration = await navigator.serviceWorker.register("/sw.js");
            subscription = await registration.pushManager.getSubscription();
          } catch { /* notification setup remains optional */ }
        }
        if (Notification.permission === "default" || (Notification.permission === "granted" && !subscription)) {
          setPushPromptListingId(listingId);
          return;
        }
      }
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

  const continueAfterPwaPrompt = async () => {
    const listingId = pwaPromptListingId;
    if (!listingId) return;
    localStorage.setItem("chat-pwa-onboarding-seen", "1");
    setPwaPromptListingId(null);
    setShowPwaInstallHelp(false);
    await openChat(listingId, false, true);
  };

  const continueAfterDeniedNotice = async () => {
    const listingId = pushDeniedListingId;
    if (!listingId) return;
    localStorage.setItem("chat-push-denied-explained", "1");
    setPushDeniedListingId(null);
    await openChat(listingId, true, true);
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
    await openChat(listingId, true, true);
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

  const continueWithoutPhoto = () => {
    if (!viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F%3Fpublish%3D1");
      return;
    }
    setPhotoName("");
    setPhotoFile(null);
    setPhotoImageKey(null);
    setItemTitle("");
    setItemDescription("");
    setItemCategory("其他");
    setCategoryManuallySelected(false);
    setItemIcon("📦");
    setAiLoading(false);
    setAiMessage("未上传照片，请手动填写商品信息");
    setPublishStep(2);
  };

  const runAiScan = async (file: File) => {
    if (!viewer) {
      window.location.assign("/signin-with-chatgpt?return_to=%2F%3Fpublish%3D1");
      return;
    }
    setPhotoName(file.name);
    setPhotoFile(file);
    setPhotoImageKey(null);
    setCategoryManuallySelected(false);
    setPublishStep(2);
    setAiLoading(true);
    setAiMessage("");

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
            aria-label="交易消息"
            onClick={() => window.location.assign(viewer ? "/messages" : "/signin-with-chatgpt?return_to=%2Fmessages")}
          >
            <Icon>♢</Icon>
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

      {!query.trim() && soldCount > 0 && recentlySold.length > 0 && (
        <section className="recent-sold-section" aria-labelledby="recent-sold-title">
          <div className="recent-sold-heading">
            <div><span className="kicker">RECENTLY SOLD</span><h2 id="recent-sold-title">好物刚刚完成接力</h2></div>
            <span className="sold-count">♻️ 已有 {soldCount} 件好物找到新主人</span>
          </div>
          <SoldListingStrip items={recentlySold} />
        </section>
      )}

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><span className="kicker">{query.trim() ? "SEARCH RESULTS" : "JUST IN"}</span><h2>{query.trim() ? "搜索结果 / 当前在售" : "刚刚上新"}</h2><p>{query.trim() ? `先看目前仍在售的「${query.trim()}」` : "看看同学们今天分享了什么"}</p></div>
          <button className="view-all">查看全部 <span>→</span></button>
        </div>
        <div className="filters" role="group" aria-label="商品分类">
          {categories.map((cat) => <button key={cat} className={category === cat ? "selected" : ""} onClick={() => setCategory(cat)}>{cat}</button>)}
        </div>
        <div className="item-grid">
          {filtered.map((item) => (
            <article className="item-card" data-testid={`item-${item.id}`} key={item.id} role="button" tabIndex={0} onClick={() => setSelectedItem(item)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedItem(item); }}>
              <div className={`item-photo ${item.tone}`}>{item.imageUrl ? <Image className="listing-image" src={item.imageUrl} alt={item.title} fill sizes="(max-width: 620px) 50vw, 33vw" unoptimized /> : <span>{item.icon}</span>}<label>{item.badge}</label>{isReducedPrice(item.price, item.originalPrice) && <b className="price-drop-badge">限时降价</b>}<button className={favorites.includes(item.id) ? "favorited" : ""} aria-label={`收藏${item.title}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}>{favorites.includes(item.id) ? "♥" : "♡"}</button></div>
              <div className="item-info">
                <h3>{item.title}</h3>
                <ListingPrice item={item} />
                <div className="meta"><span>⌖ {item.place}</span><span>{item.time}</span></div>
              </div>
            </article>
          ))}
        </div>
        {query.trim() && soldSearchLoading && filtered.length === 0 && <p className="search-history-loading">正在查找历史成交…</p>}
        {filtered.length === 0 && !soldSearchLoading && soldSearchResults.length > 0 && (
          <div className="empty"><span>🪴</span><h3>目前没有在售的「{query.trim()}」</h3><p>最近有同类商品在这里找到新主人，可以参考历史挂牌信息。</p></div>
        )}
        {filtered.length === 0 && !soldSearchLoading && !soldSearchResults.length && <div className="empty"><span>🪴</span><h3>暂时没有找到</h3><p>换个关键词看看，或者发布求购信息。</p></div>}
        {query.trim() && soldSearchResults.length > 0 && (
          <section className="sold-search-section" aria-labelledby="sold-search-title">
            <div className="recent-sold-heading"><div><span className="kicker">HISTORY REFERENCE</span><h2 id="sold-search-title">历史成交参考</h2><p>这些同类商品之前已经找到新主人</p></div></div>
            <SoldListingStrip items={soldSearchResults} />
          </section>
        )}
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

      <MobileNav active="home" homeHref="#top" viewer={Boolean(viewer)} onPublish={openPublisher} />
      <button className="mobile-publish" onClick={openPublisher}>＋ 发布闲置</button>

      {selectedItem && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedItem(null)}>
        <section className="detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedItem.title}详情`} onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" aria-label="关闭商品详情" onClick={() => setSelectedItem(null)}>×</button>
          <div className={`detail-photo ${selectedItem.tone}`}>{selectedItem.imageUrl ? <Image className="listing-image" src={selectedItem.imageUrl} alt={selectedItem.title} fill sizes="50vw" unoptimized /> : <span>{selectedItem.icon}</span>}<label>{selectedItem.badge}</label></div>
          <div className="detail-content">
            <span className="detail-category">{selectedItem.category} · {selectedItem.time}</span>
            <h2>{selectedItem.title}</h2>
            <ListingPrice item={selectedItem} detail />
            <p>{selectedItem.note}</p>
            <div className="seller-row"><span>{selectedItem.seller.slice(0,1)}</span><div><b>{selectedItem.seller}</b><small>{selectedItem.sellerVerified ? "✓ 已认证学友" : "身份待核验"} · 通常1小时内回复</small></div></div>
            <div className="pickup">⌖ 建议交接地点 <b>{selectedItem.place}附近公共场所</b></div>
            <div className="detail-actions">
              <button className={favorites.includes(selectedItem.id) ? "favorited" : ""} onClick={() => toggleFavorite(selectedItem.id)}>{favorites.includes(selectedItem.id) ? "♥ 已收藏" : "♡ 收藏"}</button>
              <button disabled={selectedItem.isOwner || contactingId === selectedItem.id} onClick={() => void openChat(selectedItem.id)}>
                {selectedItem.isOwner
                  ? "这是你的商品"
                  : contactingId === selectedItem.id
                  ? "正在连接…"
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

      {pwaPromptListingId && <div className="push-soft-backdrop" role="presentation" onClick={() => void continueAfterPwaPrompt()}>
        <section className="push-soft-dialog chat-onboarding-dialog" role="dialog" aria-modal="true" aria-label="把东北集市放到桌面" onClick={(event) => event.stopPropagation()}>
          <span>东</span>
          <h2>放到桌面后，更容易及时收到回复</h2>
          <p>从桌面打开东北集市更快捷，也更适合接收卖家的新消息通知。安装不是使用聊天的必要条件。</p>
          {showPwaInstallHelp && <div className="chat-install-help">
            {mobilePlatform() === "ios"
              ? <ol><li>点击浏览器底部的“分享”按钮 □↑</li><li>选择“添加到主屏幕”</li><li>添加后从桌面重新打开东北集市</li></ol>
              : <ol><li>点击浏览器菜单</li><li>选择“安装应用”或“添加到主屏幕”</li><li>安装后从桌面打开东北集市</li></ol>}
          </div>}
          <div>
            <button type="button" onClick={() => void continueAfterPwaPrompt()}>暂不安装，继续聊天</button>
            {showPwaInstallHelp
              ? <button type="button" onClick={() => void continueAfterPwaPrompt()}>继续设置消息通知</button>
              : <button type="button" onClick={() => setShowPwaInstallHelp(true)}>查看安装方法</button>}
          </div>
        </section>
      </div>}

      {pushDeniedListingId && <div className="push-soft-backdrop" role="presentation" onClick={() => void continueAfterDeniedNotice()}>
        <section className="push-soft-dialog chat-onboarding-dialog" role="dialog" aria-modal="true" aria-label="恢复消息通知权限" onClick={(event) => event.stopPropagation()}>
          <span>!</span>
          <h2>消息通知目前被关闭</h2>
          <p>
            {mobilePlatform() === "ios"
              ? "如需恢复，请打开系统“设置”→“通知”→“东北集市”，允许通知。你仍可直接进入聊天。"
              : mobilePlatform() === "android"
                ? "如需恢复，请在浏览器的网站设置中找到“通知”，将 market.tohokucssa.org 改为允许。你仍可直接进入聊天。"
                : "如需恢复，请点击地址栏旁的网站设置，将通知权限改为允许。你仍可直接进入聊天。"}
          </p>
          <div><button type="button" onClick={() => void continueAfterDeniedNotice()}>知道了，继续聊天</button></div>
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
              <div className="step-copy"><span>第 1 步</span><h3>上传照片，或直接填写</h3><p>上传照片后，AI 会自动识别物品、判断分类并生成标题和描述；也可以不上传照片，手动完成发布。</p><button type="button" className="demo-photo" onClick={continueWithoutPhoto}>我不想上传图片</button></div>
            </section>}

            {publishStep === 2 && <section className="wizard-pane ai-step">
              {aiLoading ? <div className="ai-loading"><span></span><b>AI 正在识别物品…</b><small>正在分析品类、品牌与外观状态</small></div> : <>
                <div className="ai-preview"><span>{itemIcon}</span><small>{photoName || "未上传图片"}</small><b>{itemCategory} · {photoName ? "自动匹配" : "手动填写"}</b></div>
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

      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}
