"use client";
import { useEffect, useRef, useState } from "react";

type Phase = { label: string; ms: number; to: number };
const PATTERNS: Record<string, { name: string; sub: string; phases: Phase[] }> = {
  calm: { name: "Calm", sub: "In 4, out 6", phases: [{ label: "Breathe in", ms: 4000, to: 1.22 }, { label: "Breathe out slowly", ms: 6000, to: 0.86 }] },
  sigh: { name: "Cyclic sigh", sub: "Double in, long out", phases: [{ label: "Breathe in", ms: 2200, to: 1.12 }, { label: "A little more air", ms: 1400, to: 1.24 }, { label: "Long, slow breath out", ms: 6000, to: 0.86 }] },
  box: { name: "Box", sub: "4 · 4 · 4 · 4", phases: [{ label: "Breathe in", ms: 4000, to: 1.22 }, { label: "Hold", ms: 4000, to: 1.22 }, { label: "Breathe out", ms: 4000, to: 0.86 }, { label: "Hold", ms: 4000, to: 0.86 }] },
};

export default function Breathe() {
  const [key, setKey] = useState("sigh");
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const timer = useRef<any>(null);
  const pat = PATTERNS[key];
  const ph = pat.phases[i % pat.phases.length];

  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => setI((x) => x + 1), ph.ms);
    return () => clearTimeout(timer.current);
  }, [running, i, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!running) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);

  const scale = running ? ph.to : 0.9;
  return (
    <main className="px-5 pt-4 pb-8 flex flex-col min-h-dvh fade-in">
      <a href="/" className="text-muted min-h-12 inline-flex items-center">← Home</a>
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="orb-wrap" aria-hidden>
          <i className="ring r3" style={{ animation: "none" }} /><i className="ring r2" style={{ animation: "none" }} />
          <div className="orb" style={{ animation: "none", transform: `scale(${scale})`, transition: `transform ${running ? ph.ms : 600}ms ease-in-out` }} />
        </div>
        <div className="text-center min-h-24" aria-live="polite">
          <p className="text-3xl font-semibold">{running ? ph.label : "Ready when you are"}</p>
          <p className="text-muted mt-1">{running ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : pat.sub}</p>
        </div>
        <div className="seg w-full" role="group" aria-label="Breathing pattern">
          {Object.entries(PATTERNS).map(([k, p]) => <button key={k} aria-pressed={key === k} onClick={() => { setKey(k); setI(0); }}>{p.name}</button>)}
        </div>
        <button onClick={() => { setRunning((r) => !r); if (running) { setSecs(0); setI(0); } }} className="btn-primary w-full min-h-[68px] rounded-3xl text-xl font-semibold">{running ? "Stop" : "Start"}</button>
        <a href="/" className="text-teal underline min-h-12 inline-flex items-center">Want me to talk you through it? Go back and tap the big button.</a>
      </div>
      <p className="text-xs text-muted text-center">Somewhere is a demo and not a medical service or crisis line.</p>
    </main>
  );
}
