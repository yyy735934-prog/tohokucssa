"use client";

import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";

export type PublishLocation = { lat: number; lng: number; label: string };

export default function PublishLocationMap({
  value,
  onChange,
}: {
  value: PublishLocation | null;
  onChange: (location: PublishLocation) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tradeMarkerRef = useRef<Marker | null>(null);
  const userLocationLayerRef = useRef<LayerGroup | null>(null);
  const updateTradeMarkerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const updateUserLocationRef = useRef<((lat: number, lng: number, accuracy: number) => void) | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let active = true;
    import("leaflet").then((L) => {
      if (!active || !containerRef.current || mapRef.current) return;
      const initial = value ?? { lat: 38.2682, lng: 140.8526, label: "仙台市内" };
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true })
        .setView([initial.lat, initial.lng], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      const pinIcon = L.divIcon({
        className: "publish-pin-shell",
        html: '<span class="publish-map-pin" aria-hidden="true"><i></i></span>',
        iconSize: [36, 46],
        iconAnchor: [18, 43],
      });
      const updateTradeMarker = (lat: number, lng: number) => {
        if (!tradeMarkerRef.current) {
          tradeMarkerRef.current = L.marker([lat, lng], {
            draggable: true,
            keyboard: true,
            title: "交易地点，可拖动调整",
            icon: pinIcon,
          }).addTo(map);
          tradeMarkerRef.current.bindTooltip("交易地点", { permanent: true, direction: "top", offset: [0, -12] });
          tradeMarkerRef.current.on("dragend", () => {
            const point = tradeMarkerRef.current!.getLatLng();
            onChangeRef.current({ lat: point.lat, lng: point.lng, label: "地图标记点" });
          });
        } else tradeMarkerRef.current.setLatLng([lat, lng]);
      };
      const updateUserLocation = (lat: number, lng: number, accuracy: number) => {
        const layer = userLocationLayerRef.current;
        if (!layer) return;
        layer.clearLayers();
        L.circle([lat, lng], {
          radius: Math.max(30, Math.min(accuracy || 100, 1000)),
          color: "#2c7055",
          fillColor: "#79b98b",
          fillOpacity: 0.14,
          weight: 1.5,
          interactive: false,
        }).addTo(layer);
        L.circleMarker([lat, lng], {
          radius: 7,
          color: "#ffffff",
          fillColor: "#2c7055",
          fillOpacity: 1,
          weight: 3,
          interactive: false,
        }).bindTooltip("我的当前位置", { permanent: true, direction: "top", offset: [0, -10], className: "user-location-tooltip" }).addTo(layer);
      };
      userLocationLayerRef.current = L.layerGroup().addTo(map);
      updateTradeMarkerRef.current = updateTradeMarker;
      updateUserLocationRef.current = updateUserLocation;
      if (value) updateTradeMarker(value.lat, value.lng);
      map.on("click", (event) => {
        updateTradeMarker(event.latlng.lat, event.latlng.lng);
        onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng, label: "地图标记点" });
      });
      mapRef.current = map;
      window.requestAnimationFrame(() => map.invalidateSize());
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      tradeMarkerRef.current = null;
      userLocationLayerRef.current = null;
      updateTradeMarkerRef.current = null;
      updateUserLocationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value) updateTradeMarkerRef.current?.(value.lat, value.lng);
  }, [value]);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationMessage("当前浏览器不支持定位，请尝试使用系统浏览器打开。");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude, label: "我的附近" };
        updateUserLocationRef.current?.(location.lat, location.lng, position.coords.accuracy);
        updateTradeMarkerRef.current?.(location.lat, location.lng);
        onChange(location);
        mapRef.current?.setView([location.lat, location.lng], 16);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) setLocationMessage("未获得定位权限；你仍可点击地图选择交易地点。");
        else if (error.code === error.TIMEOUT) setLocationMessage("定位超时，请稍后重新定位。");
        else setLocationMessage("暂时无法获取位置，请稍后重试。");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  return (
    <div className="publish-map-wrap">
      <div ref={containerRef} className="publish-location-map" aria-label="在 OpenStreetMap 上标记交易地点" />
      <div className="publish-map-tip">点击地图放置大头针，也可拖动微调</div>
      <button type="button" className="publish-locate" onClick={locate} disabled={locating}>
        ⌖ {locating ? "定位中…" : "定位到我的附近"}
      </button>
      {locationMessage && <p className="publish-location-status" role="status">{locationMessage}</p>}
    </div>
  );
}
