"use client";

import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { useEffect, useRef } from "react";

export type MapItem = {
  id: string;
  title: string;
  price: number;
  category: string;
  place: string;
  time: string;
  icon: string;
  distance: string;
  note: string;
  createdAt?: string;
  lat: number;
  lng: number;
};

export type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

type OsmMapProps = {
  items: MapItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  userLocation: UserLocation | null;
};

export default function OsmMap({ items, selectedId, onSelect, userLocation }: OsmMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const locationLayerRef = useRef<LayerGroup | null>(null);
  const leafletPromiseRef = useRef<Promise<typeof import("leaflet")> | null>(null);
  const visibleIdsRef = useRef("");
  const userLocationRef = useRef("");

  useEffect(() => {
    let active = true;
    leafletPromiseRef.current ??= import("leaflet");

    leafletPromiseRef.current.then((L) => {
      if (!active || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([38.2682, 140.8526], 13);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.zoomControl.setPosition("topright");
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        locationLayerRef.current = L.layerGroup().addTo(map);
      }

      const map = mapRef.current;
      const markerLayer = markerLayerRef.current;
      const locationLayer = locationLayerRef.current;
      if (!map || !markerLayer || !locationLayer) return;

      markerLayer.clearLayers();
      items.forEach((item) => {
        const selected = item.id === selectedId;
        const price = item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`;
        const marker = L.marker([item.lat, item.lng], {
          keyboard: true,
          title: `${item.place}：${item.title}，${price}`,
          alt: `${item.place}：${item.title}，${price}`,
          icon: L.divIcon({
            className: "osm-marker-shell",
            html: `<span class="osm-market-marker${selected ? " selected" : ""}"><i>${item.icon}</i><b>${price}</b></span>`,
            iconSize: [92, 46],
            iconAnchor: [23, 42],
          }),
        });

        marker.on("click", () => onSelect(item.id));
        marker.bindTooltip(`${item.title} · ${price}`, {
          direction: "top",
          offset: [0, -35],
        });
        marker.addTo(markerLayer);
      });

      const visibleIds = items.map((item) => item.id).join(",");
      if (items.length > 0 && visibleIds !== visibleIdsRef.current) {
        const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lng]));
        map.fitBounds(bounds.pad(0.24), { maxZoom: 14, animate: false });
      }
      visibleIdsRef.current = visibleIds;

      locationLayer.clearLayers();
      if (userLocation) {
        const radius = Math.max(200, Math.min(userLocation.accuracy, 800));
        L.circle([userLocation.lat, userLocation.lng], {
          radius,
          color: "#2c7055",
          fillColor: "#79b98b",
          fillOpacity: 0.14,
          weight: 1.5,
          interactive: false,
        }).addTo(locationLayer);

        L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 8,
          color: "#ffffff",
          fillColor: "#2c7055",
          fillOpacity: 1,
          weight: 4,
        })
          .bindTooltip("你的大致位置", {
            permanent: true,
            direction: "top",
            offset: [0, -10],
            className: "user-location-tooltip",
          })
          .addTo(locationLayer);

        const locationKey = `${userLocation.lat},${userLocation.lng}`;
        if (locationKey !== userLocationRef.current) {
          map.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
        }
        userLocationRef.current = locationKey;
      } else {
        userLocationRef.current = "";
      }

      window.requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      active = false;
    };
  }, [items, onSelect, selectedId, userLocation]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationLayerRef.current = null;
    },
    [],
  );

  return <div ref={containerRef} className="osm-map" data-testid="osm-map" />;
}
