"use client";
import { useEffect, useRef, useState } from "react";

export default function Voice() {
  const [d, setD] = useState<any>(null);
  const [playing, setPlaying] = useState("");
  const [saved, setSaved] = useState("");
  const a = useRef<HTMLAudioElement | null>(null);
  const load = () => fetch("/api/voices").then((r) => r.json()).then(setD);
  useEffect(() => { load(); }, []);
  const b64 = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  function preview(id: string) {
    a.current?.pause(); setPlaying(id);
    const el = new Audio(`/api/sos/tts?t=${b64(d.sample.text)}&s=${d.sample.sig}&v=${id}`); a.current = el;
    el.onended = () => setPlaying(""); el.onerror = () => setPlaying("");
    el.play().catch(() => setPlaying(""));
  }
  async function select(id: string) {
    await fetch("/api/voices", { method: "POST", body: JSON.stringify({ voice_id: id }) });
    setSaved("Saved on this device."); load();
  }
  return (
    <main className="p-5 pb-10 space-y-5">
      <a href="/" className="text-sm text-muted underline min-h-12 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">Choose a voice</h1>
      <p className="text-muted">Press play to hear each one. Pick the one that feels calmest.</p>
      {!d && <p className="text-muted">Loading…</p>}
      <ul className="space-y-3">
        {d?.presets.map((p: any) => (
          <li key={p.id} className="bg-surface rounded-2xl p-4 flex items-center justify-between gap-3">
            <div><p className="text-lg font-medium">{p.name}{d.selected.id === p.id ? " ✓" : ""}</p><p className="text-sm text-muted">{p.blurb}</p></div>
            <div className="flex gap-2">
              <button onClick={() => preview(p.id)} aria-label={`Preview ${p.name}`} className="px-4 min-h-12 rounded-xl bg-ground text-ink">{playing === p.id ? "Playing…" : "Play"}</button>
              <button onClick={() => select(p.id)} disabled={d.selected.id === p.id} className="px-4 min-h-12 rounded-xl bg-accent text-ground font-semibold disabled:opacity-40">{d.selected.id === p.id ? "Selected" : "Use"}</button>
            </div>
          </li>
        ))}
      </ul>
      {saved && <p role="status" className="text-teal text-sm">{saved}</p>}
    </main>
  );
}
