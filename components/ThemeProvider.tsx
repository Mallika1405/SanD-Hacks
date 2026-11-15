"use client";
import { useEffect } from "react";

export type UiSettings = { density: string; motion: string; palette: string; fontScale: number; focus: string; contrast: string };

export type Mode = "system" | "light" | "dark";
export function applyMode(m: Mode) {
  const dark = m === "dark" || (m === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  try { localStorage.setItem("sw_mode", m); } catch {}
  window.dispatchEvent(new Event("sw-mode-changed"));
}
export function getMode(): Mode { try { const m = localStorage.getItem("sw_mode"); if (m === "light" || m === "dark" || m === "system") return m; } catch {} return "system"; }

export function applyTheme(s: UiSettings) {
  const el = document.documentElement;
  el.dataset.density = s.density; el.dataset.motion = s.motion; el.dataset.palette = s.palette; el.dataset.focus = s.focus; el.dataset.contrast = s.contrast;
  el.style.setProperty("--fs", String(s.fontScale));
  try { localStorage.setItem("sw_ui", JSON.stringify(s)); } catch {}
}

/** Applies this person's layout settings (researched per condition, plus their own overrides). Cached locally to avoid a flash. */
export default function ThemeProvider() {
  useEffect(() => {
    applyMode(getMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sys = () => { if (getMode() === "system") applyMode("system"); };
    mq.addEventListener("change", sys);
    try { const c = localStorage.getItem("sw_ui"); if (c) applyTheme(JSON.parse(c)); } catch {}
    fetch("/api/ui/settings").then((r) => r.json()).then((j) => j.settings && applyTheme(j.settings)).catch(() => {});
    const on = () => fetch("/api/ui/settings").then((r) => r.json()).then((j) => j.settings && applyTheme(j.settings)).catch(() => {});
    window.addEventListener("sw-ui-changed", on);
    return () => { window.removeEventListener("sw-ui-changed", on); mq.removeEventListener("change", sys); };
  }, []);
  return null;
}
