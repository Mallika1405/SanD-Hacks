"use client";
import { useRef, useState } from "react";

export function Pill({ color = "teal", icon, children }: { color?: "teal" | "amber" | "coral" | "accent"; icon: string; children: React.ReactNode }) {
  const c = { teal: "text-teal", amber: "text-amber", coral: "text-coral", accent: "text-accent" }[color];
  return <span className={`inline-flex items-center gap-2 px-3 min-h-9 rounded-full bg-surface text-sm font-medium ${c}`}><span aria-hidden>{icon}</span><span className="text-ink">{children}</span></span>;
}

/** Hold 1 second to fire. */
export function HoldButton({ label, onFire, className = "" }: { label: string; onFire: () => void; className?: string }) {
  const [p, setP] = useState(0);
  const t = useRef<any>(null);
  const down = () => {
    const s = Date.now();
    t.current = setInterval(() => { const v = Math.min(1, (Date.now() - s) / 1000); setP(v); if (v >= 1) { clearInterval(t.current); setP(0); onFire(); } }, 40);
  };
  const up = () => { clearInterval(t.current); setP(0); };
  return (
    <button onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden select-none touch-none rounded-2xl border-2 border-coral text-coral font-semibold min-h-14 w-full ${className}`}>
      <span className="absolute inset-y-0 left-0 bg-coral/30" style={{ width: `${p * 100}%` }} />
      <span className="relative">{label} <span className="text-muted font-normal">· hold 1s</span></span>
    </button>
  );
}

export const mins = (m: number | null) => (m == null ? "unknown" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`);
export const km = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
