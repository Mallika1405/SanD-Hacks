"use client";
import { useEffect, useState } from "react";

const OPTS: [string, string, string][] = [
  ["panic", "Panic attacks", "Sudden waves of fear, a racing body"],
  ["ocd", "OCD or intrusive thoughts", "Unwanted thoughts, urges to check or seek reassurance"],
  ["gad", "Constant worry", "A mind that won't switch off"],
  ["social", "Social anxiety", "Fear of being judged or watched"],
  ["overwhelm", "Stress and burnout", "Everything piling up"],
  ["other", "Not sure yet", "I just want something calm to lean on"],
];

export default function Welcome() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(""); const [conds, setConds] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((j) => { if (j.profile) { setName(j.profile.name ?? ""); setConds(j.profile.conditions ?? []); } }); }, []);
  async function save() {
    setBusy(true);
    await fetch("/api/profile", { method: "PUT", body: JSON.stringify({ name, conditions: conds }) });
    window.location.href = "/";
  }
  return (
    <div className="max-w-[560px] mx-auto pt-10 space-y-6">
      <div className="flex gap-1.5">{[0, 1].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-sage" : "bg-stone"}`} />)}</div>
      <div key={step} className="step-in space-y-5 min-h-[320px]">
        {step === 0 && <>
          <h1>What should I call you?</h1><p className="text-ink2 -mt-2">Optional. Only used to say hello.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setStep(1)} maxLength={40} autoFocus placeholder="Your name" aria-label="Your name" />
        </>}
        {step === 1 && <>
          <h1>What are you working through?</h1><p className="text-ink2 -mt-2">Pick any that fit. This tailors how Juno talks with you. It's not a diagnosis, and you can change it any time.</p>
          <div className="space-y-2">
            {OPTS.map(([id, t, s]) => { const on = conds.includes(id); return (
              <button key={id} aria-pressed={on} onClick={() => setConds(on ? conds.filter((x) => x !== id) : [...conds, id])} className={`w-full text-left rounded-xl border px-4 py-3 transition ${on ? "border-sage bg-mint/40" : "border-line bg-linen hover:border-sage/50"}`}><span className="block font-medium">{t}</span><span className="block text-[13.5px] text-ink2">{s}</span></button>); })}
          </div>
        </>}
      </div>
      <div className="flex items-center justify-between">
        {step === 0 ? <a href="/" className="text-[14px] text-ink2 underline">Skip for now</a> : <button onClick={() => setStep(0)} className="b b-ghost">Back</button>}
        {step === 0 ? <button onClick={() => setStep(1)} className="b b-primary px-7">Next</button> : <button onClick={save} disabled={busy} className="b b-primary px-7">{busy ? "Saving…" : "Done"}</button>}
      </div>
    </div>
  );
}
