"use client";
import { useRef, useState } from "react";
import { Steps, toast, useDir } from "@/components/Motion";

type Mod = "therapy" | "groups" | "psychiatry" | "low_cost";
const GOALS = ["Panic attacks", "Unwanted thoughts", "Feeling overwhelmed", "Stress", "Feeling low", "Someone to talk to regularly"];
const PLANS = ["Aetna", "Blue Cross / Anthem", "Cigna", "Kaiser Permanente", "UnitedHealthcare", "Medi-Cal / Medicaid", "Medicare", "No insurance"];
const COMFORT = ["Woman therapist", "Man therapist", "Spanish speaking", "LGBTQ+ affirming", "Culturally specific", "Young adult / student"];
const DIRECTORIES: { name: string; url: string; what: string }[] = [
  { name: "NAMI", url: "https://www.nami.org", what: "Free peer-led support groups across the US" },
  { name: "ADAA", url: "https://adaa.org", what: "Anxiety and depression support and online community" },
  { name: "IOCDF", url: "https://iocdf.org", what: "OCD support groups and help finding care" },
  { name: "Mental Health America", url: "https://www.mhanational.org", what: "Support groups and screening tools" },
  { name: "Support Groups Central", url: "https://www.supportgroupscentral.com", what: "A directory of online and local groups" },
];

const ago = (iso: string | null) => { if (!iso) return "never"; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };

function Field({ label, text }: { label: string; text: string | null }) {
  return text ? <p className="text-[14px]"><span className="text-ink2">{label}: </span>{text} <span className="tag tag-terra ml-1">Unverified</span></p> : null;
}
const Check = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>;

export default function Care() {
  const [step, setStep] = useState(0);
  const [want, setWant] = useState<"therapist" | "group" | "both" | "low" | "">("");
  const [goals, setGoals] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number | null>(25);
  const [insurance, setInsurance] = useState("");
  const [comfort, setComfort] = useState<string[]>([]);
  const [res, setRes] = useState<any>(null);
  const [tab, setTab] = useState<"therapists" | "groups">("therapists");
  const [live, setLive] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);
  const [script, setScript] = useState("");
  const top = useRef<HTMLDivElement | null>(null);
  const dir = useDir(step);

  const needsTherapist = want !== "group";
  const order = needsTherapist ? ["want", "goals", "where", "pay", "comfort"] : ["want", "goals", "where"];
  const cur = order[step];
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const modality: Mod[] = want === "group" ? ["groups"] : want === "both" ? ["therapy", "groups"] : want === "low" ? ["low_cost", "therapy", "groups"] : ["therapy"];
  const budget = want === "low" || insurance === "No insurance" ? "low" : "flexible";
  const next = () => { setErr(""); if (cur === "where" && !city.trim() && !online) return setErr("Add your city, use your location, or choose online."); if (step < order.length - 1) setStep(step + 1); else run(); };
  const back = () => { setErr(""); setStep(Math.max(0, step - 1)); };

  function locate() {
    if (!navigator.geolocation) return setErr("Your browser can't share location. Type your city instead.");
    setLocating(true); setErr("");
    navigator.geolocation.getCurrentPosition(async (p) => {
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
      const j = await fetch("/api/care/locate", { method: "POST", body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }) }).then((r) => r.json()).catch(() => ({}));
      if (j.city) setCity(j.city); else setErr("I couldn't work out your city. Please type it.");
      setLocating(false);
    }, () => { setErr("Location was blocked. Type your city instead."); setLocating(false); }, { timeout: 8000 });
  }

  const payload = () => ({
    city: city || "San Diego, CA", goals, budget, insurance: insurance === "No insurance" ? "" : insurance,
    language: comfort.includes("Spanish speaking") ? "Spanish" : "English",
    gender: comfort.includes("Woman therapist") ? "Woman" : comfort.includes("Man therapist") ? "Man" : "No preference",
    extras: comfort.filter((c) => ["LGBTQ+ affirming", "Culturally specific", "Young adult / student"].includes(c)),
    format: online ? "online" : "either", modality, who: "individuals",
    ...(coords && !online ? { lat: coords.lat, lng: coords.lng } : {}), ...(!online && radius ? { radius } : {}),
  });

  async function makeScript(name?: string) {
    const kind = want === "group" ? "groups" : "therapy";
    const r = await fetch("/api/care/script", { method: "POST", body: JSON.stringify({ insurance: payload().insurance, kind, focus: (goals[0] ?? "anxiety").toLowerCase(), budget, name }) }).then((x) => x.json()).catch(() => null);
    if (r?.text) setScript(r.text);
  }

  async function run() {
    setErr(""); setMsg(""); setScript("");
    setTab(want === "group" ? "groups" : "therapists");
    setRes({ specialties: [], providers: [], groups: [], directory: { listings: 0, last_checked: null } });
    setWorking(true); setLive("Starting…");
    setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const r = await fetch("/api/care/search", { method: "POST", body: JSON.stringify(payload()) });
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
    setMsg("Saved on this device. You can remove it any time from You."); toast("Saved to your list");
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setMsg("Copied."); toast("Copied"); } catch { setMsg("Couldn't copy. You can select the text instead."); } }

  const Opt = ({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) => (
    <button onClick={onClick} aria-pressed={on} className={`w-full text-left rounded-xl border px-4 py-3.5 transition ${on ? "border-sage bg-mint/40" : "border-line bg-linen hover:border-sage/50"}`}><span className="block font-medium">{title}</span>{sub && <span className="block text-[13.5px] text-ink2">{sub}</span>}</button>
  );

  const wizard = !res;
  return (
    <div className="max-w-[640px] mx-auto space-y-6 fade-in" ref={top}>
      {wizard ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-stone overflow-hidden"><div className="h-full bg-sage transition-all duration-500" style={{ width: `${((step + 1) / order.length) * 100}%` }} /></div>
            <span className="text-[13px] text-ink2">{step + 1} of {order.length}</span>
          </div>

          <Steps id={cur} dir={dir} className="step-in space-y-5 min-h-[300px]">
            {cur === "want" && <>
              <h1>What kind of support are you looking for?</h1>
              <div className="space-y-2.5">
                <Opt on={want === "therapist"} onClick={() => { setWant("therapist"); setStep(1); }} title="A therapist" sub="One-on-one, with a specific named person" />
                <Opt on={want === "group"} onClick={() => { setWant("group"); setStep(1); }} title="A support group" sub="Peer or facilitated groups, online or in person" />
                <Opt on={want === "both"} onClick={() => { setWant("both"); setStep(1); }} title="Both" />
                <Opt on={want === "low"} onClick={() => { setWant("low"); setStep(1); }} title="Something free or low-cost" sub="Sliding scale, community clinics and free groups" />
              </div></>}

            {cur === "goals" && <>
              <h1>What's been hardest lately?</h1><p className="text-ink2 -mt-2">Pick any, or skip.</p>
              <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} className="chip" aria-pressed={goals.includes(g)} onClick={() => toggle(goals, g, setGoals)}>{g}</button>)}</div></>}

            {cur === "where" && <>
              <h1>Where are you?</h1>
              <label className="block"><span className="text-[13.5px] text-ink2">City or ZIP</span><input value={city} onChange={(e) => { setCity(e.target.value); setCoords(null); }} onKeyDown={(e) => e.key === "Enter" && next()} placeholder="e.g. San Diego, CA" autoFocus className="mt-1" /></label>
              <div className="flex flex-wrap gap-2"><button onClick={locate} disabled={locating} className="b b-soft border border-line">{locating ? "Waiting for your browser…" : coords ? "✓ Using your location" : "Use my location"}</button>
                <button onClick={() => setOnline(!online)} aria-pressed={online} className="chip">Online only is fine</button></div>
              {!online && <div className="space-y-2"><p className="text-[14px] text-ink2">How far are you willing to go?</p>
                <div className="flex flex-wrap gap-2">{([[5, "5 miles"], [10, "10 miles"], [25, "25 miles"], [50, "50 miles"], [0, "Any distance"]] as const).map(([v, l]) => <button key={v} className="chip" aria-pressed={(radius ?? 0) === v} onClick={() => setRadius(v || null)}>{l}</button>)}</div></div>}
              <p className="text-[13px] text-ink2">{coords ? `Using your current position${city ? ` (${city})` : ""}. ` : "Your browser will ask for permission when you tap Use my location. "}It's used only for this search, to sort by distance, and isn't stored.</p></>}

            {cur === "pay" && <>
              <h1>How will you pay?</h1><p className="text-ink2 -mt-2">I'll look for pages that mention your plan. Skip if you're not sure.</p>
              <div className="flex flex-wrap gap-2">{PLANS.map((p) => <button key={p} className="chip" aria-pressed={insurance === p} onClick={() => setInsurance(insurance === p ? "" : p)}>{p}</button>)}</div></>}

            {cur === "comfort" && <>
              <h1>Anything that would help you feel comfortable?</h1><p className="text-ink2 -mt-2">Optional. Pick any.</p>
              <div className="flex flex-wrap gap-2">{COMFORT.map((p) => <button key={p} className="chip" aria-pressed={comfort.includes(p)} onClick={() => toggle(comfort, p, setComfort)}>{p}</button>)}</div></>}

            {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
          </Steps>

          {cur !== "want" && (
            <div className="flex items-center justify-between">
              <button onClick={back} className="b b-ghost">Back</button>
              <button onClick={next} className="b b-primary px-7">{step === order.length - 1 ? "Find options" : "Next"}</button>
            </div>
          )}
          <p className="text-[12.5px] text-ink2">I read public web pages live and show what each says, with the source. Everything is unverified, so please confirm with each provider.</p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1>{working ? "Looking…" : "Here's what I found"}</h1>
            <button onClick={() => { setRes(null); setStep(0); setTab("therapists"); }} className="b b-ghost">Change answers</button>
          </div>
          {live && <p role="status" aria-live="polite" className="tag tag-sage !text-[12.5px] !py-1.5 w-fit">{working ? "● " : "✓ "}{live}</p>}
          {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}

          <div className="seg" role="tablist"><button aria-pressed={tab === "therapists"} onClick={() => setTab("therapists")}>Therapists ({res.providers.length})</button><button aria-pressed={tab === "groups"} onClick={() => setTab("groups")}>Support groups ({res.groups.length})</button></div>

          {tab === "therapists" && (
            <div className="space-y-3">
              {res.providers.length === 0 && <p className="card-flat p-5 text-ink2">{working ? "Reading pages for therapists…" : "I couldn't find good matches yet. Try another city, or check the support groups tab."}</p>}
              {res.providers.map((p: any) => (
                <article key={p.id} className="card p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="!text-[1.15rem]">{p.name}</h3>{p.credentials && <span className="tag tag-sage">{p.credentials}</span>}<span className="tag tag-stone">{p.is_individual ? "Therapist" : p.kind.replace("_", " ")}</span></div>
                  {p.clinic && p.clinic !== p.name && <p className="text-[14.5px]"><span className="text-ink2">Works at </span><b>{p.clinic}</b></p>}
                  {p.specialties?.length > 0 && <p className="text-[14.5px]">{p.specialties.slice(0, 4).join(" · ")}</p>}
                  {p.address && <p className="text-[13.5px] text-ink2">{p.address} · <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}>Directions</a></p>}
                  <p className="text-[13.5px] text-ink2">{[p.distance_mi != null ? `${p.distance_mi} mi away` : null, p.location, p.telehealth === true ? "Online available" : null, p.insurance_match ? `Mentions ${payload().insurance || "your plan"}` : null].filter(Boolean).join(" · ") || "Location not stated"}</p>
                  <details className="text-[14px]"><summary className="cursor-pointer text-ink2 underline">What their page says</summary>
                    <div className="mt-2 space-y-1"><Field label="Insurance" text={p.insurance_text} /><Field label="Cost" text={p.cost_text} /><Field label="Availability" text={p.availability_text} />{p.quote && <p className="italic text-ink2">“{p.quote}”</p>}
                      <p className="text-[12.5px] text-ink2">Unverified. Source: <a className="underline" target="_blank" rel="noreferrer" href={p.source_url}>{host(p.source_url)}</a> · checked {ago(p.checked_at)}</p></div></details>
                  <div className="flex flex-wrap gap-2 pt-1">{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="b b-primary">Open their page</a>}<button onClick={() => makeScript(p.name)} className="b b-soft border border-line">Write my message</button></div>
                </article>
              ))}
            </div>
          )}

          {tab === "groups" && (
            <div className="space-y-3">
              {res.groups.length === 0 && <p className="card-flat p-5 text-ink2">{working ? "Reading pages for support groups…" : "No specific groups found on public pages yet. These directories list groups to try:"}</p>}
              {res.groups.map((g: any) => (
                <article key={g.id} className="card p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="!text-[1.15rem]">{g.name}</h3><span className="tag">{g.kind.replace("_", " ")}</span></div>
                  <p className="text-[13.5px] text-ink2">{[g.format?.replace("_", " "), g.schedule_text, g.cost_text].filter(Boolean).join(" · ") || "Details not stated on their page"}</p>
                  {g.topics?.length > 0 && <p className="text-[14px]">{g.topics.slice(0, 4).join(" · ")}</p>}
                  <p className="text-[12.5px] text-ink2">Unverified. Source: <a className="underline" target="_blank" rel="noreferrer" href={g.source_url}>{host(g.source_url)}</a> · checked {ago(g.checked_at)}</p>
                  {g.url && <a href={g.url} target="_blank" rel="noreferrer" className="b b-slate">Open their page</a>}
                </article>
              ))}
              <div className="pt-2"><p className="eyebrow mb-2">Well-known places that list groups</p>
                <ul className="space-y-2">{DIRECTORIES.map((d) => <li key={d.name}><a href={d.url} target="_blank" rel="noreferrer" className="link-row"><span><span className="block font-medium text-[14.5px]">{d.name}</span><span className="block text-[13px] text-ink2">{d.what}</span></span><span className="text-ink2" aria-hidden>↗</span></a></li>)}</ul>
                <p className="text-[12.5px] text-ink2 mt-2">These are starting points I haven't verified. Check what's offered near you.</p></div>
            </div>
          )}

          {(script || !working) && (
            <article className="card-flat p-5 space-y-3"><h3>Not sure what to say?</h3>
              <p className="text-[14px] text-ink2">You don't have to tell your story in the first message. Paste this into an email, or read it as a voicemail.</p>
              <div className="rounded-xl border border-line p-4 text-[15px] leading-relaxed bg-linen">{script || "Writing a message for you…"}</div>
              <div className="flex flex-wrap gap-2"><button onClick={() => copy(script)} disabled={!script} className="b b-soft border border-line">Copy message</button><button onClick={save} className="b b-soft border border-line">Save this list</button></div>
              {msg && <p role="status" className="text-sage text-sm">{msg}</p>}</article>
          )}
        </>
      )}
    </div>
  );
}
