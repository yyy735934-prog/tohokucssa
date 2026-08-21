"use client";

import type { Map as LeafletMap, Marker } from "leaflet";
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
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);

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
      const updateMarker = (lat: number, lng: number) => {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], {
            draggable: true,
            keyboard: true,
            title: "交易地点，可拖动调整",
            icon: pinIcon,
          }).addTo(map);
          markerRef.current.bindTooltip("交易地点", { permanent: true, direction: "top", offset: [0, -12] });
          markerRef.current.on("dragend", () => {
            const point = markerRef.current!.getLatLng();
            onChangeRef.current({ lat: point.lat, lng: point.lng, label: "地图标记点" });
          });
        } else markerRef.current.setLatLng([lat, lng]);
      };
      if (value) updateMarker(value.lat, value.lng);
      map.on("click", (event) => {
        updateMarker(event.latlng.lat, event.latlng.lng);
        onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng, label: "地图标记点" });
      });
      mapRef.current = map;
      window.requestAnimationFrame(() => map.invalidateSize());
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && mapRef.current && markerRef.current) markerRef.current.setLatLng([value.lat, value.lng]);
  }, [value]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude, label: "我的附近" };
        onChange(location);
        mapRef.current?.setView([location.lat, location.lng], 16);
        setLocating(false);
      },
      () => setLocating(false),
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
    </div>
  );
}
