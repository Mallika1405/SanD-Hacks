"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS: { say: string; expect: string }[] = [
  { say: "Tap Start SOS session (Panic).", expect: "A calm voice begins slow breathing right away, no questions first. In the background, Bright Data starts researching calming techniques for it (see the green line on screen)." },
  { say: "When the exercise ends, answer the 1 to 10 question, for example \"seven\".", expect: "A high number: it asks what's hardest, then researches that and switches to a technique found from a trusted source, shown with its link." },
  { say: "Interrupt it mid-sentence: \"slower\".", expect: "It stops instantly, says \"Okay. Slower.\" and resumes from where it was, with longer pauses." },
  { say: "Say \"something else\".", expect: "It switches to a different exercise." },
  { say: "Say \"that made it worse\".", expect: "It thanks you, remembers not to repeat that exercise, and tries another." },
  { say: "Say \"I feel dizzy\".", expect: "It pauses to ask one yes/no safety question instead of assuming anxiety." },
  { say: "Say \"my chest hurts\".", expect: "Exercises stop. Big 911 and 988 buttons appear. It never calls anyone for you." },
  { say: "Tap \"I'm safe right now\", then \"I'm okay now\".", expect: "It wraps up and offers: keep going, stop, or a message to someone you trust." },
  { say: "Say \"stop\", then \"yes\" to a check-in.", expect: "Consent is saved. Come back here and press \"Make a check-in due now\"." },
];

export default function Demo() {
  const r = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  async function start(flow: string) {
    setBusy(flow);
    const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow }) });
    const s = await res.json(); r.push(`/session?id=${s.id}`);
  }
  async function dueNow() {
    const res = await fetch("/api/demo/checkin", { method: "POST" });
    setMsg(res.ok ? "Done. Open Home to see the check-in card." : "That only works in local dev.");
  }
  return (
    <main className="p-5 pb-12 space-y-6">
      <a href="/" className="text-sm text-muted underline min-h-12 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">Demo script</h1>
      <p className="text-muted">A simulated anxiety episode. Use Chrome, allow the microphone, and speak naturally. Interrupt any time.</p>

      <div className="grid grid-cols-1 gap-2">
        {[["panic", "Start: Panic"], ["intrusive", "Start: Intrusive thoughts"], ["overwhelm", "Start: Overwhelmed"], ["unsure", "Start: not sure what it is"]].map(([f, l]) => (
          <button key={f} disabled={!!busy} onClick={() => start(f)} className="min-h-14 rounded-2xl bg-accent text-ground font-semibold disabled:opacity-50">{busy === f ? "Starting…" : l}</button>
        ))}
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li key={i} className="bg-surface rounded-2xl p-4"><p className="font-medium">{i + 1}. {s.say}</p><p className="text-sm text-muted">{s.expect}</p></li>
        ))}
      </ol>

      <section className="bg-surface rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Then</h2>
        <button onClick={dueNow} className="w-full min-h-14 rounded-xl bg-ground">Make a check-in due now</button>
        <a href="/" className="block min-h-12 leading-[48px] underline text-accent">See the check-in card on Home</a>
        <a href="/care" className="block min-h-12 leading-[48px] underline text-accent">Find support (reads public pages live)</a>
        <a href="/voice" className="block min-h-12 leading-[48px] underline text-accent">Voices and "a voice you trust"</a>
        <a href="/me" className="block min-h-12 leading-[48px] underline text-accent">What I remember and Delete my data</a>
        {msg && <p role="status" className="text-teal text-sm">{msg}</p>}
      </section>
      <p className="text-xs text-muted">Somewhere is a demo and not a medical service or crisis line. If you're in crisis, call or text 988. For a medical emergency, call 911.</p>
    </main>
  );
}
