"use client";
import { useRef, useState } from "react";

const GOALS = ["Panic attacks", "Unwanted thoughts", "Feeling overwhelmed", "Stress", "Feeling low", "Someone to talk to regularly"];
const BUDGET: [string, "free" | "low" | "flexible"][] = [["Free options", "free"], ["Low cost or sliding scale", "low"], ["I'm flexible", "flexible"]];
const INSURANCE = ["No insurance", "Medi-Cal / Medicaid", "Through work", "Student plan", "Not sure"];
const LANGS = ["English", "Spanish", "Other"];
const GENDER = ["No preference", "Woman", "Man"];
const EXTRAS = ["LGBTQ+ affirming", "Culturally specific", "Faith-based", "Young adult / student"];
const FORMAT: [string, "online" | "in_person" | "either"][] = [["Online", "online"], ["In person", "in_person"], ["Either", "either"]];

const ago = (iso: string | null) => { if (!iso) return "never"; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const b64 = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const on = value.includes(o);
        return <button key={o} aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])}
          className={`px-4 rounded-full text-base min-h-12 ${on ? "bg-accent text-ground font-semibold" : "bg-surface text-ink"}`}>{on ? "✓ " : ""}{o}</button>;
      })}
    </div>
  );
}

function Field({ label, text }: { label: string; text: string | null }) {
  return (
    <p className="text-sm"><span className="text-muted">{label}: </span>{text ? <>{text} <span className="text-amber">(unverified, confirm with the provider)</span></> : <span className="text-muted">Not stated on their page. Ask them.</span>}</p>
  );
}

export default function Care() {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [budget, setBudget] = useState<"free" | "low" | "flexible">("flexible");
  const [insurance, setInsurance] = useState("");
  const [language, setLanguage] = useState("English");
  const [gender, setGender] = useState("No preference");
  const [extras, setExtras] = useState<string[]>([]);
  const [city, setCity] = useState("San Diego, CA");
  const [format, setFormat] = useState<"online" | "in_person" | "either">("either");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [reading, setReading] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const [live, setLive] = useState("");
  const [working, setWorking] = useState(false);

  async function run() {
    setBusy(true); setErr(""); setMsg("");
    setRes({ specialties: [], providers: [], groups: [], say: [], directory: { listings: 0, last_checked: null } });
    setStep(6); setWorking(true); setLive("Starting…");
    try {
      const r = await fetch("/api/care/search", { method: "POST", body: JSON.stringify({ city, goals, budget, insurance, language, gender, extras, format }) });
      if (!r.ok || !r.body) throw new Error();
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line);
          if (e.type === "status") setLive(e.text);
          else if (e.type === "specialties") setRes((x: any) => ({ ...x, specialties: e.specialties, say: e.say }));
          else if (e.type === "results") setRes((x: any) => ({ ...x, providers: e.providers, groups: e.groups, directory: e.directory }));
          else if (e.type === "error") setErr("Something went wrong while searching. What's shown may be incomplete.");
        }
      }
    } catch { setErr("I couldn't finish the search. What's shown may be incomplete."); }
    setWorking(false); setBusy(false);
  }

  async function listen() {
    if (reading) { audio.current?.pause(); setReading(false); return; }
    setReading(true);
    const v = (await fetch("/api/voices").then((r) => r.json()).catch(() => null))?.selected?.id ?? "EXAVITQu4vr4xnSDxMaL";
    const a = (audio.current = new Audio());
    for (const s of res.say) {
      if (!audio.current) break;
      await new Promise<void>((done) => { a.onended = () => done(); a.onerror = () => done(); a.src = `/api/sos/tts?t=${b64(s.text)}&s=${s.sig}&v=${v}`; a.play().catch(() => done()); });
      await new Promise((r) => setTimeout(r, s.pause_ms));
    }
    setReading(false);
  }

  const checklist = [
    `Do you take ${insurance && insurance !== "Not sure" && insurance !== "No insurance" ? `my insurance (${insurance})` : "insurance? If not, what do you offer?"}`,
    `What does a session cost${budget !== "flexible" ? ", and do you have a sliding scale or lower-cost option?" : "?"}`,
    "Are you accepting new clients, and how soon could I start?",
    `What's your approach for ${res?.specialties?.[0]?.name?.toLowerCase() ?? "what I'm going through"}?`,
    format !== "in_person" ? "Do you offer online sessions?" : "Where are you located, and is there parking or transit?",
    "What's your cancellation policy?",
  ];
  async function copyList() {
    try { await navigator.clipboard.writeText("Questions to ask:\n" + checklist.map((c) => `- ${c}`).join("\n")); setMsg("Copied."); } catch { setMsg("Couldn't copy. You can screenshot this list."); }
  }
  async function save() {
    await fetch("/api/care/save", { method: "POST", body: JSON.stringify({ providerIds: res.providers.map((p: any) => p.id), groupIds: res.groups.map((g: any) => g.id) }) });
    setMsg("Saved on this device. You can delete it any time under You.");
  }

  return (
    <main className="p-5 pb-12 space-y-5">
      <a href="/" className="text-sm text-muted underline min-h-12 inline-flex items-center">← Home</a>

      {step === 0 && (
        <section className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">Would you like to look for support beyond this?</h1>
          <p className="text-muted text-lg leading-snug">You don't need to know what type of therapist to look for. I'll ask a few simple questions and show options from public sources.</p>
          <button onClick={() => setStep(1)} className="w-full min-h-16 rounded-2xl bg-accent text-ground text-lg font-bold">Yes, help me look</button>
          <a href="/" className="block text-center min-h-12 leading-[48px] text-muted">Not right now</a>
        </section>
      )}
      {step === 1 && <section className="space-y-4"><h2 className="text-2xl font-semibold">What would you like help with?</h2><p className="text-muted">Pick any that fit. You can skip this.</p><Chips multi options={GOALS} value={goals} onChange={setGoals} /><Next onClick={() => setStep(2)} /></section>}
      {step === 2 && (
        <section className="space-y-4"><h2 className="text-2xl font-semibold">What fits your budget?</h2>
          <Chips options={BUDGET.map((b) => b[0])} value={[BUDGET.find((b) => b[1] === budget)![0]]} onChange={(v) => setBudget(BUDGET.find((b) => b[0] === v[0])![1])} />
          <h3 className="text-lg font-medium pt-2">Insurance</h3><Chips options={INSURANCE} value={insurance ? [insurance] : []} onChange={(v) => setInsurance(v[0])} />
          <Next onClick={() => setStep(3)} /></section>
      )}
      {step === 3 && (
        <section className="space-y-4"><h2 className="text-2xl font-semibold">Anything that would make it feel safer?</h2><p className="text-muted">All optional. Share only what you want to.</p>
          <h3 className="text-lg font-medium">Language</h3><Chips options={LANGS} value={[language]} onChange={(v) => setLanguage(v[0])} />
          <h3 className="text-lg font-medium pt-1">Therapist</h3><Chips options={GENDER} value={[gender]} onChange={(v) => setGender(v[0])} />
          <h3 className="text-lg font-medium pt-1">Also important to me</h3><Chips multi options={EXTRAS} value={extras} onChange={setExtras} />
          <Next onClick={() => setStep(4)} /></section>
      )}
      {step === 4 && (
        <section className="space-y-4"><h2 className="text-2xl font-semibold">Where, and how?</h2>
          <label className="block"><span className="text-muted text-sm">City</span><input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full bg-surface rounded-xl px-4 min-h-14 text-lg" /></label>
          <Chips options={FORMAT.map((f) => f[0])} value={[FORMAT.find((f) => f[1] === format)![0]]} onChange={(v) => setFormat(FORMAT.find((f) => f[0] === v[0])![1])} />
          <button disabled={busy} onClick={run} className="w-full min-h-16 rounded-2xl bg-accent text-ground text-lg font-bold disabled:opacity-50">{busy ? "Looking…" : "Show me options"}</button>
          {err && <p role="alert" className="text-coral">{err}</p>}</section>
      )}

      {step === 6 && res && (
        <section className="space-y-6">
          <div className="space-y-2">
            {(working || live) && <p role="status" aria-live="polite" className="bg-surface rounded-xl px-4 py-3 text-sm text-teal">{working ? "● " : "✓ "}{live}</p>}
            {err && <p role="alert" className="text-coral text-sm">{err}</p>}
            <h1 className="text-2xl font-semibold">Kinds of care you might explore</h1>
            <p className="text-sm text-muted">This isn't a diagnosis. It's a starting point for a conversation with a professional.</p>
            {res.say?.length > 0 && <button onClick={listen} className="px-4 min-h-12 rounded-full bg-surface text-teal">{reading ? "Stop reading" : "Read this to me"}</button>}
            <ul className="space-y-2">{res.specialties.map((s: any) => <li key={s.name} className="bg-surface rounded-2xl p-4"><p className="font-medium">{s.name}</p><p className="text-sm text-muted">{s.why}</p></li>)}</ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Therapists and clinics</h2>
            {!res.providers.length && <p className="text-muted bg-surface rounded-2xl p-4">{working ? "Looking through public pages for you…" : "I couldn't find good matches from public pages yet. Try changing the city or format."}</p>}
            {res.providers.map((p: any) => (
              <article key={p.id} className="bg-surface rounded-2xl p-4 space-y-1.5">
                <h3 className="text-lg font-medium">{p.name}</h3>
                <p className="text-xs text-muted uppercase tracking-wide">{p.kind.replace("_", " ")} · Unverified</p>
                {p.specialties?.length > 0 && <p className="text-sm">{p.specialties.slice(0, 5).join(" · ")}</p>}
                <p className="text-sm text-muted">{[p.location, p.telehealth === true ? "Online available" : p.telehealth === false ? "In person only" : null].filter(Boolean).join(" · ") || "Location not stated"}</p>
                <Field label="Insurance" text={p.insurance_text} /><Field label="Cost" text={p.cost_text} /><Field label="Availability" text={p.availability_text} />
                {p.quote && <p className="text-sm text-muted italic">Their page says: "{p.quote}"</p>}
                <p className="text-xs text-muted">Source: <a className="underline text-accent" target="_blank" rel="noreferrer" href={p.source_url}>{host(p.source_url)}</a> · checked {ago(p.checked_at)}</p>
                {p.url && <a className="inline-flex items-center min-h-12 text-teal underline" target="_blank" rel="noreferrer" href={p.url}>Open their page</a>}
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Support groups</h2>
            {!res.groups.length && <p className="text-muted bg-surface rounded-2xl p-4">{working ? "Looking for groups…" : "No group matches from public pages yet."}</p>}
            {res.groups.map((g: any) => (
              <article key={g.id} className="bg-surface rounded-2xl p-4 space-y-1.5">
                <h3 className="text-lg font-medium">{g.name}</h3>
                <p className="text-xs text-muted uppercase tracking-wide">{g.kind.replace("_", " ")} · {g.format?.replace("_", " ") ?? "format not stated"} · Unverified</p>
                {g.topics?.length > 0 && <p className="text-sm">{g.topics.slice(0, 5).join(" · ")}</p>}
                <Field label="Schedule" text={g.schedule_text} /><Field label="Cost" text={g.cost_text} />
                {g.quote && <p className="text-sm text-muted italic">Their page says: "{g.quote}"</p>}
                <p className="text-xs text-muted">Source: <a className="underline text-accent" target="_blank" rel="noreferrer" href={g.source_url}>{host(g.source_url)}</a> · checked {ago(g.checked_at)}</p>
                {g.url && <a className="inline-flex items-center min-h-12 text-teal underline" target="_blank" rel="noreferrer" href={g.url}>Open their page</a>}
              </article>
            ))}
          </div>

          <div className="bg-surface rounded-2xl p-4 space-y-2">
            <h2 className="text-xl font-semibold">Before you reach out</h2>
            <ul className="space-y-1.5 list-disc pl-5 text-base">{checklist.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="flex gap-2 pt-2"><button onClick={copyList} className="flex-1 min-h-12 rounded-xl bg-ground">Copy questions</button><button onClick={save} className="flex-1 min-h-12 rounded-xl bg-ground">Save this list</button></div>
            {msg && <p role="status" className="text-teal text-sm">{msg}</p>}
          </div>

          <p className="text-xs text-muted">Read live from public pages when you searched; {res.directory.listings} listings stored, last checked {ago(res.directory.last_checked)}. Insurance, cost and availability are never confirmed here. Somewhere is a demo and not a medical service or crisis line. If you're in crisis, call or text 988.</p>
          <button onClick={() => setStep(1)} className="w-full min-h-12 rounded-2xl bg-surface">Change my answers</button>
        </section>
      )}
    </main>
  );
}

function Next({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="w-full min-h-16 rounded-2xl bg-accent text-ground text-lg font-bold mt-2">Next</button>;
}
