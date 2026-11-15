"use client";
import { useRef, useState } from "react";

const GOALS = ["Panic attacks", "Unwanted thoughts", "Feeling overwhelmed", "Stress", "Feeling low", "Someone to talk to regularly"];
const MODALITY: { id: "therapy" | "groups" | "psychiatry" | "low_cost"; title: string; sub: string }[] = [
  { id: "therapy", title: "Individual therapy", sub: "One-on-one with a therapist" },
  { id: "groups", title: "Support groups", sub: "Peer or facilitated groups" },
  { id: "psychiatry", title: "Psychiatry / meds", sub: "A prescriber, if you want one" },
  { id: "low_cost", title: "Sliding scale & community", sub: "Free or lower-cost clinics" },
];
const PLANS = ["Aetna", "Blue Cross / Anthem", "Cigna", "Kaiser Permanente", "UnitedHealthcare", "Medi-Cal / Medicaid", "Medicare", "Self-pay", "No insurance"];
const BUDGET: [string, "free" | "low" | "flexible"][] = [["Free only", "free"], ["Lower cost / sliding scale", "low"], ["Flexible", "flexible"]];
const LANGS = ["English", "Spanish", "Other"];
const GENDER = ["No preference", "Woman", "Man"];
const EXTRAS = ["LGBTQ+ affirming", "Culturally specific", "Faith-based", "Young adult / student"];
const FORMAT: [string, "online" | "in_person" | "either"][] = [["Online", "online"], ["In person", "in_person"], ["Either", "either"]];

const ago = (iso: string | null) => { if (!iso) return "never"; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };

function Field({ label, text }: { label: string; text: string | null }) {
  return <p className="text-[14px]"><span className="text-ink2">{label}: </span>{text ? <>{text} <span className="tag tag-terra ml-1">Unverified</span></> : <span className="text-ink2">Not stated on their page. Ask them.</span>}</p>;
}

export default function Care() {
  const [goals, setGoals] = useState<string[]>([]);
  const [modality, setModality] = useState<("therapy" | "groups" | "psychiatry" | "low_cost")[]>(["therapy", "groups"]);
  const [insurance, setInsurance] = useState("");
  const [budget, setBudget] = useState<"free" | "low" | "flexible">("flexible");
  const [language, setLanguage] = useState("English");
  const [gender, setGender] = useState("No preference");
  const [extras, setExtras] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<"online" | "in_person" | "either">("either");
  const [who, setWho] = useState<"individuals" | "practices" | "either">("individuals");
  const [res, setRes] = useState<any>(null);
  const [live, setLive] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);
  const [script, setScript] = useState("");
  const results = useRef<HTMLDivElement | null>(null);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function locate() {
    if (!navigator.geolocation) return setErr("Your browser can't share location. Type your city instead.");
    setLocating(true); setErr("");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const j = await fetch("/api/care/locate", { method: "POST", body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }) }).then((r) => r.json()).catch(() => ({}));
      if (j.city) setCity(j.city); else setErr("I couldn't work out your city. Please type it.");
      setLocating(false);
    }, () => { setErr("Location was blocked. Type your city instead."); setLocating(false); }, { timeout: 8000 });
  }

  async function makeScript(name?: string) {
    const kind = modality.includes("groups") && !modality.includes("therapy") ? "groups" : modality.includes("psychiatry") && !modality.includes("therapy") ? "psychiatry" : "therapy";
    const r = await fetch("/api/care/script", { method: "POST", body: JSON.stringify({ insurance, kind, focus: (goals[0] ?? "anxiety").toLowerCase(), budget, name }) }).then((x) => x.json()).catch(() => null);
    if (r?.text) setScript(r.text);
  }

  async function run() {
    if (!city.trim()) return setErr("Add your city, or tap “Use my location”, so I can look nearby.");
    setErr(""); setMsg(""); setScript("");
    setRes({ specialties: [], providers: [], groups: [], directory: { listings: 0, last_checked: null } });
    setWorking(true); setLive("Starting…");
    setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const r = await fetch("/api/care/search", { method: "POST", body: JSON.stringify({ city, goals, budget, insurance, language, gender, extras, format, modality, who }) });
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
          else if (e.type === "specialties") setRes((x: any) => ({ ...x, specialties: e.specialties }));
          else if (e.type === "results") setRes((x: any) => ({ ...x, providers: e.providers, groups: e.groups, directory: e.directory }));
          else if (e.type === "error") setErr("Something went wrong while searching. What's shown may be incomplete.");
        }
      }
    } catch { setErr("I couldn't finish the search. What's shown may be incomplete."); }
    setWorking(false);
    makeScript();
  }

  async function save() {
    await fetch("/api/care/save", { method: "POST", body: JSON.stringify({ providerIds: res.providers.map((p: any) => p.id), groupIds: res.groups.map((g: any) => g.id) }) });
    setMsg("Saved on this device. You can remove it any time under Between Moments.");
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setMsg("Copied."); } catch { setMsg("Couldn't copy. You can select the text instead."); } }

  const sources = res ? [...new Map([...res.providers, ...res.groups].map((x: any) => [host(x.source_url), x])).entries()] : [];

  return (
    <div className="space-y-8 fade-in">
      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-end">
        <div>
          <span className="tag">Read live from public pages</span>
          <h1 className="mt-3 text-[2.6rem] lg:text-[3.2rem] leading-[1.08]">Finding care without the maze.</h1>
          <p className="mt-3 text-ink2 prose-narrow">Tell me where you are, what you'd like help with, and your insurance or budget. I'll read public pages for therapists and groups near you and show exactly what each page says, with the source.</p>
        </div>
        <div className="card-flat p-5 text-[14px] text-ink2"><p className="font-semibold text-ink">How to read this</p><p className="mt-1">Everything here is read from public pages and <b>not verified by us</b>. Insurance, cost and availability are what a page says, so always confirm with the provider.</p></div>
      </section>

      {/* ---------- guided filter ---------- */}
      <section className="card p-6 lg:p-8 space-y-7" aria-label="Guided filter">
        <h2 className="text-[1.6rem]">Start where you are</h2>

        <div className="space-y-3"><h3 className="text-[1.15rem]"><span className="text-sage font-semibold mr-2">1</span>What feels most pressing right now? <span className="text-[13px] text-ink2 font-normal">(pick any)</span></h3>
          <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} className="chip" aria-pressed={goals.includes(g)} onClick={() => toggle(goals, g, setGoals)}>{g}</button>)}</div></div>

        <div className="space-y-3"><h3 className="text-[1.15rem]"><span className="text-sage font-semibold mr-2">2</span>What kind of care are you open to?</h3>
          <div className="grid sm:grid-cols-2 gap-2">{MODALITY.map((m) => { const on = modality.includes(m.id); return (
            <button key={m.id} role="checkbox" aria-checked={on} onClick={() => toggle(modality, m.id, setModality)} className="check-row"><span className="box">{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span><span className="block font-semibold text-[15px]">{m.title}</span><span className="block text-[13.5px] text-ink2">{m.sub}</span></span></button>); })}</div></div>

        <div className="space-y-3"><h3 className="text-[1.15rem]">Who are you looking for?</h3>
          <div className="seg max-w-lg" role="group" aria-label="Who">{([["A specific therapist", "individuals"], ["A clinic or practice", "practices"], ["Either", "either"]] as const).map(([l, v]) => <button key={v} aria-pressed={who === v} onClick={() => setWho(v)}>{l}</button>)}</div>
          <p className="text-[13px] text-ink2">Specific therapists means named people with their credentials, from public profiles. These are unverified, so please check their license.</p></div>

        <div className="space-y-3"><h3 className="text-[1.15rem]"><span className="text-sage font-semibold mr-2">3</span>Insurance or budget</h3>
          <div className="flex flex-wrap gap-2">{PLANS.map((p) => <button key={p} className="chip" aria-pressed={insurance === p} onClick={() => setInsurance(insurance === p ? "" : p)}>{p}</button>)}</div>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <label className="block"><span className="text-[13.5px] text-ink2">Another plan, or a plan name</span><input value={PLANS.includes(insurance) ? "" : insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="e.g. Oscar, Tricare, my school's plan" className="mt-1" /></label>
            <div className="seg" role="group" aria-label="Budget">{BUDGET.map(([l, v]) => <button key={v} aria-pressed={budget === v} onClick={() => setBudget(v)}>{l}</button>)}</div></div>
          <p className="text-[13px] text-ink2">I search for pages that mention your plan and show what they say. That is not confirmation they accept it.</p></div>

        <div className="space-y-3"><h3 className="text-[1.15rem]"><span className="text-sage font-semibold mr-2">4</span>Where, and how?</h3>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="block"><span className="text-[13.5px] text-ink2">City or ZIP</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Diego, CA" className="mt-1" autoComplete="address-level2" /></label>
            <button onClick={locate} disabled={locating} className="b b-ghost">{locating ? "Finding you…" : "Use my location"}</button></div>
          <p className="text-[13px] text-ink2">Your location is only used to find your city. It isn't stored.</p>
          <div className="seg max-w-sm" role="group" aria-label="Format">{FORMAT.map(([l, v]) => <button key={v} aria-pressed={format === v} onClick={() => setFormat(v)}>{l}</button>)}</div></div>

        <details className="card-flat p-4"><summary className="cursor-pointer font-semibold min-h-10 flex items-center">Anything that would make it feel safer? <span className="text-ink2 font-normal ml-2 text-[13px]">(optional)</span></summary>
          <div className="mt-3 space-y-4"><div><p className="eyebrow mb-2">Language</p><div className="flex flex-wrap gap-2">{LANGS.map((l) => <button key={l} className="chip" aria-pressed={language === l} onClick={() => setLanguage(l)}>{l}</button>)}</div></div>
            <div><p className="eyebrow mb-2">Therapist</p><div className="flex flex-wrap gap-2">{GENDER.map((l) => <button key={l} className="chip" aria-pressed={gender === l} onClick={() => setGender(l)}>{l}</button>)}</div></div>
            <div><p className="eyebrow mb-2">Also important to me</p><div className="flex flex-wrap gap-2">{EXTRAS.map((l) => <button key={l} className="chip" aria-pressed={extras.includes(l)} onClick={() => toggle(extras, l, setExtras)}>{l}</button>)}</div></div></div></details>

        <div className="flex flex-wrap items-center gap-3"><button onClick={run} disabled={working} className="b b-primary !min-h-[52px] px-8">{working ? "Reading public pages…" : "Find options"}</button>
          {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}</div>
      </section>

      {/* ---------- results ---------- */}
      <div ref={results} className="scroll-mt-24" />
      {res && (
        <section className="space-y-6" aria-label="Results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.9rem]">{working ? "Looking through public pages…" : `${res.providers.length + res.groups.length} matches`}</h2>
            {live && <p role="status" aria-live="polite" className="tag tag-sage !text-[12.5px] !py-1.5">{working ? "● " : "✓ "}{live}</p>}
          </div>

          {res.specialties?.length > 0 && (
            <div className="card-flat p-5"><p className="eyebrow">Kinds of care you might explore</p>
              <ul className="mt-2 grid sm:grid-cols-2 gap-3">{res.specialties.map((s: any) => <li key={s.name}><p className="font-semibold">{s.name}</p><p className="text-[14px] text-ink2">{s.why}</p></li>)}</ul>
              <p className="mt-2 text-[12.5px] text-ink2">This isn't a diagnosis. It's a starting point for a conversation with a professional.</p></div>
          )}

          {res.providers.length === 0 && <p className="card-flat p-5 text-ink2">{working ? "Reading pages for therapists and clinics…" : "I couldn't find good matches on public pages yet. Try another city or care type."}</p>}
          <div className="space-y-4">
            {res.providers.map((p: any) => (
              <article key={p.id} className="card overflow-hidden grid md:grid-cols-[1fr_auto]">
                <div className="p-5 lg:p-6 space-y-2 border-t-4 border-sage/50 md:border-t-0 md:border-l-4">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-[1.5rem] leading-tight">{p.name}</h3><span className="tag tag-stone">{p.is_individual ? "Individual therapist" : p.kind.replace("_", " ")}</span>{p.credentials && <span className="tag tag-sage">{p.credentials}</span>}</div>
                  {p.specialties?.length > 0 && <p className="text-[15px]">{p.specialties.slice(0, 5).join(" · ")}</p>}
                  <p className="text-[14px] text-ink2">{[p.location, p.telehealth === true ? "Online available" : p.telehealth === false ? "In person only" : null].filter(Boolean).join(" · ") || "Location not stated"}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.insurance_match ? <span className="tag tag-sage">Their page mentions {insurance || "your plan"}</span> : insurance && !/^(no insurance|self-pay|not sure)$/i.test(insurance) ? <span className="tag tag-stone">Plan not mentioned. Ask them.</span> : null}
                    <span className="tag tag-terra">Unverified listing</span>
                  </div>
                  <Field label="Insurance" text={p.insurance_text} /><Field label="Cost" text={p.cost_text} /><Field label="Availability" text={p.availability_text} />
                  {p.quote && <p className="text-[14px] text-ink2 italic">Their page says: “{p.quote}”</p>}
                  <p className="text-[12.5px] text-ink2">Source: <a className="underline text-slate" target="_blank" rel="noreferrer" href={p.source_url}>{host(p.source_url)}</a> · checked {ago(p.checked_at)}</p>
                </div>
                <div className="p-5 lg:p-6 flex md:flex-col gap-2 md:justify-center md:w-[220px] bg-cream/60">
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="b b-primary flex-1 md:flex-none">Open their page</a>}
                  <button onClick={() => makeScript(p.name)} className="b b-ghost flex-1 md:flex-none">Write my message</button>
                </div>
              </article>
            ))}
          </div>

          {res.groups.length > 0 && <h2 className="text-[1.6rem] pt-2">Support groups</h2>}
          <div className="space-y-4">
            {res.groups.map((g: any) => (
              <article key={g.id} className="card overflow-hidden grid md:grid-cols-[1fr_auto]">
                <div className="p-5 lg:p-6 space-y-2 border-t-4 border-slate/40 md:border-t-0 md:border-l-4">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-[1.5rem] leading-tight">{g.name}</h3><span className="tag">{g.kind.replace("_", " ")}</span></div>
                  <p className="text-[14px] text-ink2">{g.format?.replace("_", " ") ?? "Format not stated"}{g.topics?.length ? ` · ${g.topics.slice(0, 4).join(" · ")}` : ""}</p>
                  <Field label="Schedule" text={g.schedule_text} /><Field label="Cost" text={g.cost_text} />
                  {g.quote && <p className="text-[14px] text-ink2 italic">Their page says: “{g.quote}”</p>}
                  <span className="tag tag-terra">Unverified listing</span>
                  <p className="text-[12.5px] text-ink2">Source: <a className="underline text-slate" target="_blank" rel="noreferrer" href={g.source_url}>{host(g.source_url)}</a> · checked {ago(g.checked_at)}</p>
                </div>
                {g.url && <div className="p-5 lg:p-6 flex md:flex-col gap-2 md:justify-center md:w-[220px] bg-cream/60"><a href={g.url} target="_blank" rel="noreferrer" className="b b-slate flex-1 md:flex-none">Open their page</a></div>}
              </article>
            ))}
          </div>

          {(script || !working) && (
            <article className="card-flat p-6 space-y-3"><p className="eyebrow">Overwhelmed making the call?</p><h3 className="text-[1.5rem]">What to say when reaching out</h3>
              <p className="text-[14.5px] text-ink2 prose-narrow">You don't have to explain your story in the first message. Paste this into an email or read it as a voicemail.</p>
              <div className="bg-white rounded-xl border border-line p-4 text-[15px] leading-relaxed">{script || "Writing a message for you…"}</div>
              <div className="flex gap-2"><button onClick={() => copy(script)} disabled={!script} className="b b-soft border border-line">Copy message</button><button onClick={save} className="b b-soft border border-line">Save this list</button></div>
              {msg && <p role="status" className="text-sage text-sm">{msg}</p>}</article>
          )}

          <article className="card-flat p-6"><h3 className="text-[1.4rem]">Where this data comes from</h3>
            <p className="mt-2 text-[14.5px] text-ink2 prose-narrow">When you searched, Bright Data found and read public web pages, Gemini pulled out what each page states, and Neon stored it with the source and time. Nothing is verified, ranked by payment, or sponsored.</p>
            <ul className="mt-3 flex flex-wrap gap-2">{sources.map(([h, x]: any) => <li key={h} className="tag tag-stone">{h} · {ago(x.checked_at)}</li>)}{!sources.length && <li className="text-[14px] text-ink2">Sources appear as pages are read.</li>}</ul></article>
        </section>
      )}
    </div>
  );
}
