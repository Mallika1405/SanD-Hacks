"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const FLOW: Record<string, string> = { panic: "Panic", intrusive: "Intrusive thoughts", overwhelm: "Overwhelmed", unsure: "Not sure", checkin: "Check-in" };

export default function Me() {
  const r = useRouter();
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/me").then((x) => x.json()).then(setD).catch(() => setD({ sessions: [], prefs: null, saved: { providers: [], groups: [] } }));
  useEffect(() => { load(); }, []);

  async function stopCheckins() { await fetch("/api/checkins", { method: "DELETE" }); setMsg("Check-ins are off."); load(); }
  async function forget() { await fetch("/api/me", { method: "PATCH" }); setMsg("I've forgotten what helps."); load(); }
  async function wipe() {
    if (!confirm("Delete everything Somewhere has saved about you on this device, including a cloned voice? This can't be undone.")) return;
    const res = await fetch("/api/me", { method: "DELETE" }); const j = await res.json().catch(() => ({}));
    if (!j.ok) return setMsg("I couldn't delete your cloned voice, so nothing was removed. Please try again.");
    setMsg("Everything was deleted."); setTimeout(() => r.push("/"), 900);
  }

  return (
    <main className="p-5 pb-12 space-y-6">
      <a href="/" className="text-sm text-muted underline min-h-12 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">You</h1>
      <p className="text-sm text-muted">Only what you chose to keep. Self-reported, never clinical.</p>
      {!d && <p className="text-muted">Loading…</p>}

      {d && (
        <>
          <section className="bg-surface rounded-2xl p-4 space-y-2">
            <h2 className="text-lg font-semibold">What I remember</h2>
            {d.prefs?.favorite || d.prefs?.hard_times ? (
              <ul className="text-base space-y-1">
                {d.prefs.favorite && <li>Helps you: <span className="text-teal">{d.prefs.favorite}</span></li>}
                {d.prefs.hard_times && <li>Harder times: {d.prefs.hard_times}</li>}
              </ul>
            ) : <p className="text-muted">Nothing yet. I only remember things after you say yes.</p>}
            <p className="text-sm text-muted">Voice: {d.prefs?.voice_name ? `${d.prefs.voice_name}${d.prefs.voice_kind === "clone" ? " (a voice you trust)" : ""}` : "default"}</p>
            <p className="text-sm text-muted">Check-ins: {d.prefs?.checkins_opt_in ? `on${d.checkin ? `, next ${when(d.checkin.due_at)}` : ""}` : "off"}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {d.prefs?.checkins_opt_in && <button onClick={stopCheckins} className="px-4 min-h-12 rounded-xl bg-ground">Turn off check-ins</button>}
              {(d.prefs?.favorite || d.prefs?.hard_times) && <button onClick={forget} className="px-4 min-h-12 rounded-xl bg-ground">Forget what helps</button>}
              <a href="/voice" className="px-4 min-h-12 rounded-xl bg-ground inline-flex items-center">Change voice</a>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">When you reached out</h2>
            {!d.sessions.length && <p className="text-muted bg-surface rounded-2xl p-4">No sessions yet.</p>}
            {d.sessions.map((s: any) => (
              <article key={s.id} className="bg-surface rounded-2xl p-4">
                <p className="font-medium">{FLOW[s.flow] ?? s.flow} · <span className="text-muted font-normal">{when(s.started_at)}</span></p>
                {s.tried.length > 0 && <p className="text-sm text-muted">Tried: {[...new Set(s.tried)].join(", ")}</p>}
                {s.helpful.length > 0 && <p className="text-sm text-teal">You said this helped: {s.helpful.join(", ")}</p>}
              </article>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Saved support</h2>
            {!d.saved.providers.length && !d.saved.groups.length && <p className="text-muted bg-surface rounded-2xl p-4">Nothing saved. <a href="/care" className="underline text-accent">Find support</a></p>}
            {[...d.saved.providers, ...d.saved.groups].map((x: any) => <a key={x.id} href={x.source_url} target="_blank" rel="noreferrer" className="block bg-surface rounded-2xl p-4 underline">{x.name}</a>)}
          </section>

          <section className="space-y-2 pt-2">
            <button onClick={wipe} className="w-full min-h-14 rounded-2xl border border-coral text-coral font-semibold">Delete my data</button>
            <p className="text-xs text-muted">Removes your history, preferences, check-ins, saved lists and any cloned voice, on this device and at ElevenLabs.</p>
          </section>
        </>
      )}
      {msg && <p role="status" className="text-teal text-sm">{msg}</p>}
      <p className="text-xs text-muted">Somewhere is a demo and not a medical service or crisis line.</p>
    </main>
  );
}
