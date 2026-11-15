"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const FLOWS = [
  { id: "panic", label: "Panic" },
  { id: "intrusive", label: "Intrusive thoughts" },
  { id: "overwhelm", label: "Overwhelmed" },
] as const;

export default function Home() {
  const r = useRouter();
  const [flow, setFlow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [due, setDue] = useState<{ id: string } | null>(null);
  useEffect(() => { fetch("/api/checkins/due").then((r) => r.json()).then((j) => setDue(j.due)).catch(() => {}); }, []);

  async function startCheckin() {
    setBusy(true);
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow: "checkin", checkinId: due!.id }) });
      const s = await res.json(); r.push(`/session?id=${s.id}`);
    } catch { setErr("I couldn't start. Please try again."); setBusy(false); }
  }

  async function start() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow: flow ?? "unsure" }) });
      if (!res.ok) throw new Error();
      const s = await res.json();
      r.push(`/session?id=${s.id}`);
    } catch { setErr("I couldn't start. Please try again."); setBusy(false); }
  }

  return (
    <main className="p-6 pb-10 flex flex-col min-h-dvh">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-2xl font-semibold tracking-tight">somewhere.</h1>
        <nav className="flex gap-1 text-sm">
          <a href="/voice" className="px-3 min-h-12 inline-flex items-center rounded-full bg-surface text-ink">Voice</a>
          <a href="/care" className="px-3 min-h-12 inline-flex items-center text-muted">Support</a>
          <a href="/me" className="px-3 min-h-12 inline-flex items-center text-muted">You</a>
        </nav>
      </header>

      {due && (
        <section aria-label="Check-in" className="mt-4 bg-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div><p className="font-medium">You asked me to check in.</p><p className="text-sm text-muted">Takes about a minute. Skip it any time.</p></div>
          <button disabled={busy} onClick={startCheckin} className="px-4 min-h-12 rounded-xl bg-accent text-ground font-semibold disabled:opacity-50">Talk</button>
        </section>
      )}

      <section className="flex-1 flex flex-col justify-center gap-6 py-8">
        <div className="orb paused" aria-hidden />
        <div className="text-center space-y-2">
          <p className="text-3xl font-semibold leading-tight">I'm here with you.</p>
          <p className="text-muted text-lg leading-snug">You don't have to explain anything. Start whenever you're ready.</p>
        </div>
      </section>

      <section className="space-y-4">
        <div role="group" aria-label="What is it like right now (optional)" className="flex flex-wrap justify-center gap-2">
          {FLOWS.map((f) => (
            <button key={f.id} aria-pressed={flow === f.id} onClick={() => setFlow(flow === f.id ? null : f.id)}
              className={`px-4 rounded-full text-base ${flow === f.id ? "bg-accent text-ground font-semibold" : "bg-surface text-ink"}`}>
              {flow === f.id ? "✓ " : ""}{f.label}
            </button>
          ))}
        </div>
        <button disabled={busy} onClick={start} className="w-full min-h-20 rounded-3xl bg-accent text-ground text-xl font-bold disabled:opacity-50">
          {busy ? "Starting…" : "Start SOS session"}
        </button>
        {err && <p role="alert" className="text-coral text-center">{err}</p>}
        <p className="text-xs text-muted text-center pt-2">
          Somewhere is a demo and not a medical service or crisis line. If you might hurt yourself or this is a medical emergency, call or text 988, or call 911.
        </p>
      </section>
    </main>
  );
}
