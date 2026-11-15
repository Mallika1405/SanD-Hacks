"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Stop = { at: string; secs: number; title: string; as: string; name: string; to: string; say: string; do: string; show: string };
const STOPS: Stop[] = [
  { at: "0:00", secs: 15, title: "Hook and sign in", as: "jordan_panic", name: "Jordan", to: "/", say: "At 3am, mid-panic, generic apps don't talk to you. Anchor does, and it's tailored to each person.", do: "Open as Jordan (panic).", show: "Calm Today screen, next therapy session, one big help card." },
  { at: "0:15", secs: 70, title: "Panic, in the moment", as: "jordan_panic", name: "Jordan", to: "/now", say: "I just tell it what's happening in my own words, by voice. It talks back, live.", do: "Tap \"Tell me in my own words\", say: \"My heart is racing and I can't stop shaking.\" When Juno offers breathing, let it run for about 20 seconds. Then say \"I'm still panicking.\" Open More → Sources.", show: "Juno opens by reflecting what you said, runs a counted breathing walkthrough with on-screen steps, escalates when you say it isn't working, and Sources shows pages Bright Data read and research behind the advice." },
  { at: "1:25", secs: 15, title: "Safety first", as: "jordan_panic", name: "Jordan", to: "/now", say: "And safety always beats smoothness.", do: "Say: \"My chest hurts.\"", show: "It stops the exercise and shows 911 and 988. It never treats chest pain as anxiety." },
  { at: "1:40", secs: 35, title: "Diary that talks back", as: "riley_social", name: "Riley", to: "/diary", say: "The diary is a conversation, by voice or text, and it keeps my actual words.", do: "Tap Write instead, type one sentence about a social moment, read its reply. Then open Sam's Today to show a flagged entry.", show: "A gentle follow-up question, no advice dump. Sam's heavy entry shows 988, 911 and a note for the therapist." },
  { at: "2:15", secs: 30, title: "Find a specific therapist", as: "sam_burnout", name: "Sam", to: "/care", say: "It finds real therapists near me, the clinic they work for, and support groups.", do: "Run a search before the demo so it's instant. Show Therapists, then Support groups.", show: "Named therapists with clinic, distance and phone, Google Maps clinics, and groups, all labeled unverified." },
  { at: "2:45", secs: 15, title: "Close", as: "riley_social", name: "Riley", to: "/you", say: "Private by default, honest about what it doesn't know, and not a medical service. Built with ElevenLabs, Gemini, Neon and Bright Data.", do: "Open You and show Conversations with Juno and Delete my data.", show: "Saved conversations she can read or delete, and one-tap data deletion." },
];

export default function Demo() {
  const r = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function go(s: Stop) {
    setBusy(s.at); setErr("");
    const res = await fetch("/api/auth/demo", { method: "POST", body: JSON.stringify({ handle: s.as }) });
    if (!res.ok) { setBusy(""); setErr("Demo profiles only work on localhost. Run npm run seed first."); return; }
    r.push(s.to); r.refresh();
  }
  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <section><h1>3-minute demo</h1><p className="mt-1.5 text-ink2">Six stops with timings and what to say. Each button signs in as the right demo profile and opens the page.</p></section>
      <details className="card-flat p-4"><summary className="cursor-pointer font-medium">Before you present</summary>
        <ul className="mt-2 list-disc pl-5 text-[14.5px] text-ink2 space-y-1"><li>Restart the server, run <code>npm run seed</code> once, and allow the microphone in Chrome.</li><li>Run one Find care search for your city first, so results are ready.</li><li>Pick Juno's voice on the Voices page and turn on Extra soothing if you like.</li><li>If the mic fails, use the "Use guided steps" link as a backup.</li></ul></details>
      {err && <p role="alert" className="text-terra text-[14px]">{err}</p>}
      <ol className="space-y-3">
        {STOPS.map((s) => (
          <li key={s.at} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[13px] text-ink2">{s.at} · about {s.secs}s</p><p className="font-medium">{s.title}</p></div>
              <button onClick={() => go(s)} disabled={busy === s.at} className="b b-primary shrink-0">{busy === s.at ? "Opening…" : `Open as ${s.name}`}</button>
            </div>
            <p className="text-[14.5px]"><b>Say:</b> {s.say}</p>
            <p className="text-[14.5px]"><b>Do:</b> {s.do}</p>
            <p className="text-[14.5px] text-ink2"><b>They'll see:</b> {s.show}</p>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] text-ink2">Anchor is a demo and not a medical service or crisis line.</p>
    </div>
  );
}
