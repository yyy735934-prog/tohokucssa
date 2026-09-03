"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LISTING_CATEGORIES } from "../../lib/listing-intelligence";
import { matchesMarketSearch } from "../../lib/market-search";
import OsmMap, { type MapItem, type UserLocation } from "./OsmMap";
import MyMarketNav from "../MyMarketNav";

const categories = ["全部", ...LISTING_CATEGORIES];
const areas = ["全部区域", "川内", "青叶山", "片平", "北仙台", "八幡", "三条町"];
const placeCoordinates: Record<string, [number, number]> = {
  川内: [38.2614, 140.8364],
  青叶山: [38.2572, 140.8186],
  片平: [38.2503, 140.8720],
  北仙台: [38.2817, 140.8691],
  八幡: [38.2700, 140.8454],
  三条町: [38.2830, 140.8525],
};

function distanceInKm(from: UserLocation, item: MapItem) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(item.lat - from.lat);
  const longitudeDelta = toRadians(item.lng - from.lng);
  const startLatitude = toRadians(from.lat);
  const endLatitude = toRadians(item.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceLabel(from: UserLocation | null, item: MapItem) {
  if (!from) return item.distance;
  const distance = distanceInKm(from, item);
  return distance < 1 ? `约 ${Math.max(100, Math.round(distance * 10) * 100)} m` : `约 ${distance.toFixed(1)} km`;
}

export default function MarketMap() {
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  const [category, setCategory] = useState("全部");
  const [area, setArea] = useState("全部区域");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "ready" | "error">("idle");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/listings")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          listings?: Array<Omit<MapItem, "lat" | "lng" | "distance"> & {
            lat?: number | null;
            lng?: number | null;
          }>;
        };
      })
      .then((result) => {
        if (!active || !result?.listings) return;
        const nextItems = result.listings.map((listing) => {
            const base =
              listing.lat !== null && listing.lat !== undefined &&
              listing.lng !== null && listing.lng !== undefined
                ? [listing.lat, listing.lng]
                : placeCoordinates[listing.place] ?? [38.2682, 140.8526];
            return {
              ...listing,
              lat: base[0],
              lng: base[1],
              distance: "仙台市内",
            };
          });
        setMapItems(nextItems);
        setSelectedId((current) =>
          current && nextItems.some((item) => item.id === current)
            ? current
            : nextItems[0]?.id ?? "",
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const matches = mapItems.filter((item) =>
      (category === "全部" || item.category === category) &&
      (area === "全部区域" || item.place === area) &&
      matchesMarketSearch(item, query)
    );
    return userLocation
      ? [...matches].sort((first, second) => distanceInKm(userLocation, first) - distanceInKm(userLocation, second))
      : matches;
  }, [area, category, mapItems, query, userLocation]);

  const selected = mapItems.find((item) => item.id === selectedId);
  const liveStats = useMemo(() => {
    const now = new Date();
    const isToday = (value?: string) => {
      if (!value) return false;
      const date = new Date(
        value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
      );
      if (Number.isNaN(date.getTime())) return false;
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };

    return {
      today: mapItems.filter((item) => isToday(item.createdAt)).length,
      free: mapItems.filter((item) => item.price === 0).length,
      areas: new Set(mapItems.map((item) => item.place).filter(Boolean)).size,
    };
  }, [mapItems]);

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("当前浏览器不支持定位，请尝试使用系统浏览器打开。");
      return;
    }

    setLocationStatus("locating");
    setLocationMessage("正在获取大致位置…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const approximateLocation = {
          lat: Math.round(position.coords.latitude * 1000) / 1000,
          lng: Math.round(position.coords.longitude * 1000) / 1000,
          accuracy: Math.max(200, position.coords.accuracy),
        };
        setUserLocation(approximateLocation);
        setLocationStatus("ready");
        setLocationMessage("已定位到大致区域，附近闲置已按距离排序。");
      },
      (error) => {
        setLocationStatus("error");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("未获得定位权限。你仍可按区域浏览二手物品。");
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("定位超时，请稍后再试。");
        } else {
          setLocationMessage("暂时无法获取位置，请稍后再试。");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <main className="market-map-page">
      <header className="topbar map-topbar">
        <Link className="brand" href="/" aria-label="返回东北集市首页">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>学友会二手平台</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">
          <Link href="/">逛集市</Link>
          <Link className="active" href="/map">二手地图</Link>
          <Link href="/#guide">交易指南</Link>
          <Link href="/#about">关于平台</Link>
        </nav>
        <Link className="back-market" href="/">返回集市 <span>→</span></Link>
      </header>
      <MyMarketNav active="map" />

      <section className="map-intro">
        <div>
          <span className="map-eyebrow">SERVICE MAP · SECONDHAND</span>
          <h1>在附近，发现下一件好物</h1>
          <p>从地图上查看川内、青叶山、片平与生活区附近正在出售的闲置，优先找到顺路、方便交接的物品。</p>
        </div>
        <div className="map-summary">
          <span><b>{liveStats.today}</b><small>今日在售</small></span>
          <span><b>{liveStats.free}</b><small>免费赠送</small></span>
          <span><b>{liveStats.areas}</b><small>覆盖区域</small></span>
        </div>
      </section>

      <section className="map-toolbar" aria-label="二手地图筛选">
        <label className="map-search">
          <span>⌕</span>
          <input aria-label="搜索地图商品" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索地图上的闲置…" />
        </label>
        <div className="map-categories" role="group" aria-label="商品分类">
          {categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <label className="area-select">
          <span>⌖</span>
          <select aria-label="选择地图区域" value={area} onChange={(e) => setArea(e.target.value)}>
            {areas.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="map-workspace">
        <aside className="nearby-list">
          <div className="list-heading">
            <div><span>NEARBY</span><h2>附近闲置</h2></div>
            <b>{filtered.length} 件</b>
          </div>
          <div className="compact-items">
            {filtered.map((item) => (
              <button key={item.id} className={selectedId === item.id ? "compact-item selected" : "compact-item"} onClick={() => setSelectedId(item.id)}>
                <span className="compact-photo map-tone-live">{item.icon}</span>
                <span className="compact-copy">
                  <b>{item.title}</b>
                  <strong>{item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`}</strong>
                  <small><i>⌖</i> {item.place} · {distanceLabel(userLocation, item)}</small>
                </span>
                <span className="compact-arrow">›</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="map-empty"><span>⌖</span><b>附近暂时没有</b><small>试试其他分类或区域</small></div>}
          </div>
        </aside>

        <div className="map-canvas" aria-label="使用 OpenStreetMap 的仙台二手商品地图">
          <OsmMap items={filtered} selectedId={selectedId} onSelect={setSelectedId} userLocation={userLocation} />
          <div className="map-action-stack">
            <button
              className={`map-locate-button ${locationStatus}`}
              onClick={locateUser}
              disabled={locationStatus === "locating"}
              aria-describedby="location-privacy-note"
            >
              <span>{locationStatus === "locating" ? "◌" : "⌖"}</span>
              {locationStatus === "ready" ? "重新定位" : locationStatus === "locating" ? "定位中…" : "定位我的附近"}
            </button>
            <div className="map-source-badge"><i></i> OSM 实时底图</div>
          </div>

          {locationMessage && (
            <div className={`location-status ${locationStatus}`} role="status" aria-live="polite">
              {locationMessage}
            </div>
          )}

          {selected && filtered.some((item) => item.id === selected.id) && <article className="map-popup" aria-live="polite">
            <button className="popup-close" aria-label="关闭地图商品卡片" onClick={() => setSelectedId("")}>×</button>
            <div className="popup-photo map-tone-live">{selected.icon}</div>
            <div>
              <span>{selected.category} · {selected.time}</span>
              <h3>{selected.title}</h3>
              <b>{selected.price === 0 ? "免费赠送" : `¥${selected.price.toLocaleString()}`}</b>
              <p>{selected.note}</p>
              <small>⌖ {selected.place}附近交接 · {distanceLabel(userLocation, selected)}</small>
            </div>
            <Link href={`/?listing=${selected.id}`}>查看详情 →</Link>
          </article>}

          <div className="map-legend" id="location-privacy-note"><span><i className="legend-dot"></i>闲置物品</span><small>定位仅在本机处理，不保存精确坐标</small></div>
        </div>
      </section>

      <nav className="mobile-nav map-mobile-nav" aria-label="移动端导航">
        <Link href="/"><span>⌂</span>首页</Link>
        <Link className="active" href="/map"><span>⌖</span>附近</Link>
        <Link className="nav-publish" href="/?publish=1" aria-label="发布闲置">＋</Link>
        <Link href="/favorites"><span>♡</span>收藏</Link>
        <Link href="/account"><span>♙</span>我的</Link>
      </nav>
    </main>
  );
}
