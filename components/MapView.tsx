"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMarker = { lat: number; lng: number; color: string; label: string; shape?: "dot" | "pin" };
export type MapLine = { coords: [number, number][]; color: string; dashed?: boolean };
export type MapHeat = { lat: number; lng: number; w?: number };

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: { base: { type: "raster", tileSize: 256, attribution: "© OpenStreetMap contributors",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"] } },
  // Darken standard OSM tiles so the map matches the dark UI (no API key needed).
  layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-brightness-max": 0.38, "raster-brightness-min": 0, "raster-saturation": -0.7, "raster-contrast": 0.25 } }],
};

export default function MapView({ center, markers = [], lines = [], heat = [], follow = true, className = "h-72" }: {
  center: { lat: number; lng: number }; markers?: MapMarker[]; lines?: MapLine[]; heat?: MapHeat[]; follow?: boolean; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mk = useRef<maplibregl.Marker[]>([]);
  const ready = useRef(false);
  const fitted = useRef(false);

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: STYLE, center: [center.lng, center.lat], zoom: 15.5, attributionControl: { compact: true } });
    map.current = m;
    m.on("load", () => {
      m.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "lines-solid", type: "line", source: "lines", filter: ["!=", ["get", "dashed"], true], paint: { "line-color": ["get", "color"], "line-width": 5 } });
      m.addLayer({ id: "lines-dash", type: "line", source: "lines", filter: ["==", ["get", "dashed"], true], paint: { "line-color": ["get", "color"], "line-width": 5, "line-dasharray": [1.2, 1.4] } });
      m.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "heat", type: "circle", source: "heat", paint: { "circle-radius": 28, "circle-color": "#FF7A6B", "circle-opacity": 0.28, "circle-blur": 0.9 } });
      ready.current = true; (m as any)._upd?.();
    });
    return () => { m.remove(); map.current = null; ready.current = false; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const upd = () => {
      if (!ready.current) return;
      (m.getSource("lines") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection",
        features: lines.map((l) => ({ type: "Feature", properties: { color: l.color, dashed: !!l.dashed }, geometry: { type: "LineString", coordinates: l.coords.map(([a, b]) => [b, a]) } })) });
      (m.getSource("heat") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection",
        features: heat.map((h) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [h.lng, h.lat] } })) });
    };
    (m as any)._upd = upd; upd();
    mk.current.forEach((x) => x.remove());
    mk.current = markers.map((k) => {
      const d = document.createElement("div");
      d.setAttribute("aria-label", k.label); d.title = k.label;
      d.style.cssText = `width:${k.shape === "pin" ? 26 : 18}px;height:${k.shape === "pin" ? 26 : 18}px;border-radius:50%;background:${k.color};border:3px solid #12111A;box-shadow:0 0 0 2px ${k.color}66;display:flex;align-items:center;justify-content:center;font:700 11px Inter,sans-serif;color:#12111A`;
      if (k.shape === "pin") d.textContent = k.label[0];
      return new maplibregl.Marker({ element: d }).setLngLat([k.lng, k.lat]).addTo(m);
    });
  }, [markers, lines, heat]);

  useEffect(() => {
    const m = map.current; if (!m || !follow) return;
    if (!fitted.current || follow) m.easeTo({ center: [center.lng, center.lat], duration: 600 });
    fitted.current = true;
  }, [center.lat, center.lng, follow]);

  return <div ref={el} className={`w-full rounded-2xl overflow-hidden ${className}`} role="img" aria-label="Map" />;
}
