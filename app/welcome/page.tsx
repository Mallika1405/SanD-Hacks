"use client";
import { useEffect, useState } from "react";

const OPTS: [string, string, string][] = [
  ["panic", "Panic attacks", "Sudden waves of fear, a racing body"],
  ["ocd", "OCD or intrusive thoughts", "Unwanted thoughts, urges to check, wash or seek reassurance"],
  ["gad", "Constant worry", "A mind that won't switch off"],
  ["social", "Social anxiety", "Fear of being judged or watched"],
  ["overwhelm", "Stress and burnout", "Everything piling up"],
  ["other", "Not sure yet", "I just want something calm to lean on"],
];

export default function Welcome() {
  const [name, setName] = useState(""); const [conds, setConds] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((j) => { if (j.profile) { setName(j.profile.name ?? ""); setConds(j.profile.conditions ?? []); } }); }, []);
  async function save() {
    setBusy(true);
    await fetch("/api/profile", { method: "PUT", body: JSON.stringify({ name, conditions: conds }) });
    window.location.href = "/";
  }
  return (
    <div className="max-w-[720px] mx-auto space-y-6 fade-in">
      <div><span className="tag">A little about you</span><h1 className="mt-3 text-[2.4rem] leading-tight">What are you working through?</h1>
        <p className="mt-2 text-ink2 prose-narrow">Pick anything that fits. This tailors how Juno talks with you and which tracker you get. It's not a diagnosis, you can change it any time, and you can skip it.</p></div>
      <div className="card p-6 space-y-5">
        <label className="block"><span className="text-[14px] text-ink2">What should I call you? (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1" /></label>
        <div className="grid sm:grid-cols-2 gap-2">
          {OPTS.map(([id, t, s]) => { const on = conds.includes(id); return (
            <button key={id} role="checkbox" aria-checked={on} onClick={() => setConds(on ? conds.filter((x) => x !== id) : [...conds, id])} className="check-row"><span className="box">{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span><span className="block font-semibold text-[15px]">{t}</span><span className="block text-[13.5px] text-ink2">{s}</span></span></button>); })}
        </div>
        <div className="flex flex-wrap gap-3"><button onClick={save} disabled={busy} className="b b-primary">{busy ? "Saving…" : "Save and continue"}</button><a href="/" className="b b-ghost">Skip for now</a></div>
        <p className="text-[12.5px] text-ink2">Stored in your profile and used only to tailor this app. You can delete it under Between Moments.</p>
      </div>
    </div>
  );
}
