"use client";
import { useEffect, useRef, useState } from "react";
import { LL, Simulator } from "../sim";

export type Fix = { lat: number; lng: number; t: number };

/** Tracks position (real GPS or simulator), posts every 5s, holds a wake lock. Only runs while sessionId is set. */
export function useTracker(sessionId: string | null) {
  const [pos, setPos] = useState<Fix | null>(null);
  const [trail, setTrail] = useState<LL[]>([]);
  const sim = useRef<Simulator | null>(null);
  const last = useRef<Fix | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let wl: any = null, watchId: number | null = null, simTimer: any, postTimer: any;
    const params = new URLSearchParams(location.search);
    const simKey = params.get("sim") || sessionStorage.getItem("haven_sim");
    const push = (lat: number, lng: number) => {
      const f = { lat, lng, t: Date.now() };
      last.current = f; setPos(f); setTrail((t) => [...t.slice(-300), [lat, lng]]);
    };
    (navigator as any).wakeLock?.request("screen").then((l: any) => (wl = l)).catch(() => {});
    if (simKey) {
      sessionStorage.setItem("haven_sim", simKey);
      sim.current = new Simulator(simKey);
      (window as any).__haven = { deviate: () => sim.current?.deviate(), stop: (v = true) => sim.current?.stop(v) };
      push(...sim.current.pos);
      simTimer = setInterval(() => { const p = sim.current!.tick(); push(p[0], p[1]); }, 1000);
    } else if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition((p) => push(p.coords.latitude, p.coords.longitude), () => {}, { enableHighAccuracy: true });
    }
    postTimer = setInterval(() => {
      const f = last.current; if (!f) return;
      fetch(`/api/sessions/${sessionId}/location`, { method: "POST", body: JSON.stringify({ lat: f.lat, lng: f.lng }) }).catch(() => {});
    }, 5000);
    const vis = () => { if (document.visibilityState === "visible") (navigator as any).wakeLock?.request("screen").then((l: any) => (wl = l)).catch(() => {}); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(simTimer); clearInterval(postTimer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      wl?.release?.(); document.removeEventListener("visibilitychange", vis);
    };
  }, [sessionId]);

  return { pos, trail, simulator: sim };
}
