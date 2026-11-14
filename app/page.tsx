"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DESTINATIONS } from "@/lib/presets";
import { densify, ROUTES } from "@/lib/sim";

type Mode = "walk" | "ride" | "party";
const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "walk", label: "Walk", icon: "🚶" }, { id: "ride", label: "Ride", icon: "🚗" }, { id: "party", label: "Party", icon: "🎉" },
];

function getPos(): Promise<[number, number]> {
  const sim = new URLSearchParams(location.search).get("sim") || sessionStorage.getItem("haven_sim");
  if (sim && ROUTES[sim]) return Promise.resolve(ROUTES[sim].points[0]);
  return new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res([p.coords.latitude, p.coords.longitude]), () => res([32.8801, -117.234]), { timeout: 5000 }));
}

export default function Home() {
  const r = useRouter();
  const [mode, setMode] = useState<Mode>("walk");
  const [dest, setDest] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [custom, setCustom] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { const s = new URLSearchParams(location.search).get("sim"); if (s) sessionStorage.setItem("haven_sim", s); }, []);

  const destination = custom ?? (dest != null ? DESTINATIONS[dest] : null);

  async function start(m: Mode | "emergency") {
    setBusy(true); setErr("");
    try {
      const sim = sessionStorage.getItem("haven_sim");
      let d = m === "party" || m === "emergency" ? null : destination;
      if (sim && ROUTES[sim] && m === "ride" && !d) d = ROUTES[sim].dest;
      let expected: [number, number][] | null = null;
      if (m === "ride" && d) {
        if (sim && ROUTES[sim]) expected = densify(ROUTES[sim].points);
        else {
          const from = await getPos();
          const j = await fetch(`/api/route?mode=drive&from=${from}&to=${d.lat},${d.lng}`).then((x) => x.json());
          expected = j.routes?.[0]?.coords ?? null;
        }
      }
      const res = await fetch("/api/sessions", { method: "POST", body: JSON.stringify({ mode: m, destination: d, expectedRoute: expected }) });
      const s = await res.json();
      if (!res.ok) throw new Error(typeof s.error === "string" ? s.error : "Could not start");
      localStorage.setItem("haven_session", JSON.stringify(s));
      r.push("/active");
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  async function search() { setFound((await fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((x) => x.json())).results); }

  return (
    <main className="p-5 pb-10 space-y-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-3xl font-semibold tracking-tight">Haven</h1>
        <nav className="flex gap-4 text-sm text-muted"><a href="/vault" className="underline min-h-11 inline-flex items-center">Vault</a><a href="/onboarding" className="underline min-h-11 inline-flex items-center">Contacts</a></nav>
      </header>
      <p className="text-muted">I'll stay on the line. Pick how you're getting around.</p>
      <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-3">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
            className={`rounded-2xl py-4 flex flex-col items-center gap-1 border-2 ${mode === m.id ? "border-accent bg-surface text-ink" : "border-transparent bg-surface/60 text-muted"}`}>
            <span className="text-2xl" aria-hidden>{m.icon}</span><span className="text-sm font-medium">{m.label}{mode === m.id ? " ✓" : ""}</span>
          </button>
        ))}
      </div>
      {mode !== "party" && (
        <section aria-label="Destination" className="space-y-2">
          <h2 className="text-sm text-muted">{mode === "ride" ? "Where are you headed?" : "Where to? (optional)"}</h2>
          <div className="flex flex-wrap gap-2">
            {DESTINATIONS.map((d, i) => (
              <button key={d.name} onClick={() => { setDest(dest === i ? null : i); setCustom(null); }}
                className={`px-3 rounded-full min-h-11 text-sm ${dest === i && !custom ? "bg-accent text-ground font-semibold" : "bg-surface text-ink"}`}>{dest === i && !custom ? "✓ " : ""}{d.name}</button>
            ))}
          </div>
          <details className="text-sm text-muted"><summary className="min-h-11 flex items-center cursor-pointer">Type a place instead</summary>
            <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-surface rounded-xl px-3 min-h-11 text-ink" placeholder="Address or place" />
              <button onClick={search} className="px-4 rounded-xl bg-surface text-ink">Find</button></div>
            {found.map((f) => <button key={f.name} onClick={() => { setCustom(f); setDest(null); setFound([]); }} className="block w-full text-left min-h-11 text-ink">{f.name}</button>)}
          </details>
          {custom && <p className="text-sm text-teal">✓ {custom.name}</p>}
        </section>
      )}
      <button disabled={busy || (mode === "ride" && !destination && !sessionStorage.getItem("haven_sim"))} onClick={() => start(mode)}
        className="w-full min-h-20 rounded-3xl bg-accent text-ground text-xl font-bold disabled:opacity-40">{busy ? "Starting…" : `Start ${mode}`}</button>
      {mode === "ride" && !destination && <p className="text-xs text-muted text-center">Pick a destination so I can watch the route.</p>}
      {err && <p role="alert" className="text-coral text-sm">{err}</p>}
      <button onClick={() => start("emergency")} disabled={busy} className="w-full min-h-12 rounded-2xl border border-coral/60 text-coral text-sm">Emergency — alert my contacts now</button>
      <p className="text-xs text-muted text-center">Haven doesn't replace 911. I only listen and track while a session is on.</p>
    </main>
  );
}
