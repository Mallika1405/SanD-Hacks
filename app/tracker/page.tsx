"use client";
import { useCallback, useEffect, useState } from "react";
import { Count, Skeleton, Steps, toast, useDir } from "@/components/Motion";

type Kind = "ocd_urge" | "panic_episode" | "daily";
const TABS: { id: Kind; label: string; sub: string }[] = [
  { id: "ocd_urge", label: "Urge tracker", sub: "For OCD and intrusive thoughts" },
  { id: "panic_episode", label: "Panic log", sub: "Episodes and what helped" },
  { id: "daily", label: "Daily check", sub: "A quick look at how today is" },
];
const TRIGGERS = ["Contamination", "Checking (door, stove)", "Harm thoughts", "Symmetry / just right", "Reassurance", "Mental review", "Other"];
const URGES = ["Check", "Wash or clean", "Ask for reassurance", "Review in my head", "Avoid", "Repeat or redo", "Other"];
const WAITS = [2, 5, 10, 15, 30, 45];
const HELPED = ["Slow breathing", "Grounding", "Talked to someone", "A walk", "Cold water", "Juno", "Nothing yet"];
const P_TRIG = ["None I can tell", "Crowded place", "Caffeine", "Bed / night", "Work or school", "A reminder", "Other"];
const MIN_OPTS = [3, 5, 10, 20, 30];
const SLEEP = ["Under 5h", "5 to 7h", "7 to 9h", "9h+"];
const MOOD = ["Very low", "Low", "Okay", "Good", "Great"];
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Spark({ data, max, color = "#2F5D50", bars }: { data: number[]; max: number; color?: string; bars?: boolean }) {
  if (data.length < 2) return <p className="text-[13px] text-ink2">A few more entries and a trend will appear.</p>;
  const w = 240, h = 52, step = w / (data.length - 1 || 1);
  if (bars) return <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Trend">{data.map((v, i) => { const bh = Math.max(2, (v / max) * (h - 4)); return <rect key={i} x={i * (w / data.length) + 2} y={h - bh} width={Math.max(3, w / data.length - 4)} height={bh} rx="2" fill={color} opacity=".8" />; })}</svg>;
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Trend"><polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={data.map((v, i) => `${i * step},${h - 4 - (v / max) * (h - 8)}`).join(" ")} /></svg>;
}
const Chips = ({ opts, val, onPick }: { opts: (string | number)[]; val: any; onPick: (v: any) => void }) => <div className="flex flex-wrap gap-2">{opts.map((o) => <button key={o} type="button" className="chip" aria-pressed={val === o} onClick={() => onPick(val === o ? null : o)}>{o}</button>)}</div>;
const Multi = ({ opts, val, onPick }: { opts: string[]; val: string[]; onPick: (v: string[]) => void }) => <div className="flex flex-wrap gap-2">{opts.map((o) => <button key={o} type="button" className="chip" aria-pressed={val.includes(o)} onClick={() => onPick(val.includes(o) ? val.filter((x) => x !== o) : [...val, o])}>{o}</button>)}</div>;
const Slider = ({ label, v, set, min = 0, max = 10 }: { label: string; v: number; set: (n: number) => void; min?: number; max?: number }) => <label className="block"><span className="text-[14.5px] font-medium">{label}: <b className="text-sage">{v}</b> / {max}</span><input type="range" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className="!min-h-0 !p-0 !border-0 !bg-transparent accent-[#2F5D50] mt-1" /></label>;

export default function Tracker() {
  const [kind, setKind] = useState<Kind>("daily");
  const [data, setData] = useState<{ logs: any[]; insights: any } | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false); const [step, setStep] = useState(0);
  const dir = useDir(step);
  // ocd
  const [trigger, setTrigger] = useState<string | null>(null); const [urge, setUrge] = useState<string | null>(null); const [resp, setResp] = useState<"did" | "delayed" | "resisted" | null>(null);
  const [wait, setWait] = useState<number | null>(null); const [before, setBefore] = useState(6); const [after, setAfter] = useState(4); const [note, setNote] = useState("");
  // panic
  const [intensity, setIntensity] = useState(7); const [mins, setMins] = useState<number | null>(10); const [pTrig, setPTrig] = useState<string | null>(null); const [helped, setHelped] = useState<string[]>([]);
  // daily
  const [mood, setMood] = useState(3); const [anx, setAnx] = useState(4); const [sleep, setSleep] = useState<string | null>(null);

  const load = useCallback((k: Kind) => { setData(null); fetch(`/api/tracker?kind=${k}`).then((r) => r.json()).then(setData).catch(() => setData({ logs: [], insights: {} })); }, []);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((j) => { const c = j.profile?.conditions ?? []; setKind(c.includes("ocd") ? "ocd_urge" : c.includes("panic") ? "panic_episode" : "daily"); }).catch(() => {});
  }, []);
  useEffect(() => { load(kind); setMsg(""); setErr(""); setLogging(false); setStep(0); }, [kind, load]);

  async function save() {
    setErr(""); setMsg("");
    let payload: any;
    if (kind === "ocd_urge") {
      if (!trigger || !urge || !resp) return setErr("Pick what set it off, what the urge said, and what you did.");
      payload = { trigger, urge, response: resp, delay_min: resp === "delayed" ? wait ?? undefined : undefined, before, after, note: note.trim() || undefined };
    } else if (kind === "panic_episode") payload = { intensity, minutes: mins ?? 0, trigger: pTrig ?? undefined, helped };
    else payload = { mood: mood + 1, anxiety: anx, sleep: sleep ?? undefined, helped };
    setBusy(true);
    const r = await fetch("/api/tracker", { method: "POST", body: JSON.stringify({ kind, data: payload }) });
    setBusy(false);
    if (!r.ok) return setErr("I couldn't save that. Please try again.");
    setMsg(kind === "ocd_urge" ? (resp === "did" ? "Logged. That's okay. Noticing it is part of the work, and tomorrow is a fresh try." : resp === "delayed" ? "Logged. Waiting, even a little, is the skill." : "Logged. Resisting is hard. That took effort.") : "Logged.");
    toast("Logged"); setTrigger(null); setUrge(null); setResp(null); setWait(null); setNote(""); setHelped([]); setLogging(false); setStep(0); load(kind);
  }
  async function del(id: string) { if (!confirm("Delete this entry?")) return; await fetch(`/api/tracker?id=${id}`, { method: "DELETE" }); load(kind); }

  const steps: string[] = kind === "ocd_urge" ? ["trigger", "urge", "resp", ...(resp === "delayed" ? ["wait"] : []), "before", "after", "note"] : kind === "panic_episode" ? ["intensity", "mins", "ptrig", "helped"] : ["mood", "anx", "sleep", "helped"];
  const cur = steps[Math.min(step, steps.length - 1)];
  const need = (cur === "trigger" && !trigger) || (cur === "urge" && !urge) || (cur === "resp" && !resp);
  const nextStep = () => (step >= steps.length - 1 ? save() : setStep(step + 1));
  const I = data?.insights ?? {};
  const tab = TABS.find((t) => t.id === kind)!;

  const Q = ({ children }: { children: React.ReactNode }) => <h2 className="!text-[1.5rem]">{children}</h2>;
  return (
    <div className="max-w-[640px] mx-auto space-y-6 fade-in">
      <section><h1>Tracker</h1><p className="mt-1.5 text-ink2">A quick log and a clear picture over time. No streaks, no guilt. Self-tracking, not treatment.</p></section>

      <div className="seg" role="tablist" aria-label="Tracker type">{TABS.map((t) => <button key={t.id} role="tab" aria-pressed={kind === t.id} onClick={() => setKind(t.id)}>{t.label}</button>)}</div>

      {!logging ? (
        <section className="card p-5 flex items-center justify-between gap-3" aria-label="Log an entry">
          <div><p className="font-medium">{kind === "ocd_urge" ? "Log an urge" : kind === "panic_episode" ? "Log a panic episode" : "How is today?"}</p><p className="text-[13.5px] text-ink2">{tab.sub}. Takes under a minute.</p></div>
          <button onClick={() => { setLogging(true); setStep(0); setMsg(""); setErr(""); }} className="b b-primary shrink-0">Start</button>
        </section>
      ) : (
        <section className="space-y-5" aria-label="Log an entry">
          <div className="flex items-center gap-3"><div className="flex-1 h-1.5 rounded-full bg-stone overflow-hidden"><div className="h-full bg-sage transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><span className="text-[13px] text-ink2">{step + 1} of {steps.length}</span></div>
          <Steps id={cur} dir={dir} className="step-in space-y-4 min-h-[240px]">
            {cur === "trigger" && <><Q>What set it off?</Q><Chips opts={TRIGGERS} val={trigger} onPick={setTrigger} /></>}
            {cur === "urge" && <><Q>What did the urge tell you to do?</Q><Chips opts={URGES} val={urge} onPick={setUrge} /></>}
            {cur === "resp" && <><Q>What did you do?</Q>
              <div className="space-y-2">{([["did", "I did it", "That's okay. Just log it."], ["delayed", "I delayed it", "Waited before giving in"], ["resisted", "I resisted fully", "Didn't do it at all"]] as const).map(([k, t, s2]) => (
                <button key={k} type="button" aria-pressed={resp === k} onClick={() => setResp(k)} className={`w-full text-left rounded-xl px-4 py-3 border ${resp === k ? "bg-mint/50 border-sage" : "bg-linen border-line"}`}><span className="block font-medium">{t}</span><span className="block text-[13px] text-ink2">{s2}</span></button>))}</div></>}
            {cur === "wait" && <><Q>How long did you wait?</Q><Chips opts={WAITS.map((w) => `${w} min`)} val={wait ? `${wait} min` : null} onPick={(v) => setWait(v ? parseInt(v) : null)} /></>}
            {cur === "before" && <><Q>How distressing was it before?</Q><Slider label="Before" v={before} set={setBefore} /></>}
            {cur === "after" && <><Q>And after?</Q><Slider label="After" v={after} set={setAfter} /></>}
            {cur === "note" && <><Q>Anything you want to remember?</Q><label className="block"><span className="text-[13.5px] text-ink2">Optional note</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} className="mt-1" /></label></>}
            {cur === "intensity" && <><Q>How intense did it get?</Q><Slider label="Intensity" v={intensity} set={setIntensity} /></>}
            {cur === "mins" && <><Q>About how long did it last?</Q><Chips opts={MIN_OPTS.map((m) => `${m} min`)} val={mins ? `${mins} min` : null} onPick={(v) => setMins(v ? parseInt(v) : null)} /></>}
            {cur === "ptrig" && <><Q>Any trigger?</Q><Chips opts={P_TRIG} val={pTrig} onPick={setPTrig} /></>}
            {cur === "helped" && <><Q>What helped?</Q><Multi opts={HELPED} val={helped} onPick={setHelped} /></>}
            {cur === "mood" && <><Q>How's your mood?</Q><div className="seg">{MOOD.map((m, i) => <button key={m} type="button" aria-pressed={mood === i} onClick={() => setMood(i)}>{m}</button>)}</div></>}
            {cur === "anx" && <><Q>How anxious are you today?</Q><Slider label="Anxiety" v={anx} set={setAnx} /></>}
            {cur === "sleep" && <><Q>How did you sleep?</Q><Chips opts={SLEEP} val={sleep} onPick={setSleep} /></>}
            {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
          </Steps>
          <div className="flex items-center justify-between">
            <button onClick={() => (step === 0 ? setLogging(false) : setStep(step - 1))} className="b b-ghost">{step === 0 ? "Cancel" : "Back"}</button>
            <button onClick={nextStep} disabled={busy || need} className="b b-primary px-7">{step >= steps.length - 1 ? (busy ? "Saving…" : "Save") : "Next"}</button>
          </div>
        </section>
      )}
      {msg && <p role="status" className="card-flat p-4 text-sage font-medium">{msg}</p>}

      {!logging && (
      <div className="space-y-6">
        {/* ---------- insights ---------- */}
        <div className="space-y-6">
          <article className="card p-6 space-y-4">
            <h2 className="text-[1.6rem]">Over time</h2>
            {!data && <Skeleton lines={4} />}
            {data && !I.total && <p className="text-[14.5px] text-ink2">Nothing logged yet. Your first entry starts the picture.</p>}
            {data && I.total > 0 && kind === "ocd_urge" && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.resisted) || 0} /></p><p className="text-[12px] text-ink2">Resisted</p></div>
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.delayed) || 0} /></p><p className="text-[12px] text-ink2">Delayed</p></div>
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.did) || 0} /></p><p className="text-[12px] text-ink2">Did it</p></div>
                </div>
                <p className="text-[15px]">You delayed or resisted <b>{I.total - I.did} of {I.total}</b> urges{I.rateLast != null ? ` (${I.rateLast}% of your last ${Math.min(7, I.total)})` : ""}.{I.ratePrev != null && I.rateLast != null && I.rateLast !== I.ratePrev ? ` The week before it was ${I.ratePrev}%.` : ""}</p>
                {I.avgDelay != null && <p className="text-[15px]">When you delay, you wait about <b>{I.avgDelay} minutes</b> on average.</p>}
                {I.relief != null && <p className="text-[15px]">Distress usually drops by about <b>{I.relief}</b> points by the time you log.</p>}
                <div><p className="eyebrow mb-1">How long you waited (oldest to newest)</p><Spark data={I.delayTrend ?? []} max={Math.max(30, ...(I.delayTrend ?? [0]))} bars /></div>
                {I.triggers?.length > 0 && <div><p className="eyebrow">Most common triggers</p><div className="mt-1 flex flex-wrap gap-1.5">{I.triggers.map((t: any) => <span key={t.name} className="tag tag-stone">{t.name} · {t.n}</span>)}</div></div>}
                <p className="text-[12.5px] text-ink2">Self-tracking only. Therapy called ERP with a trained clinician is the standard, best-studied approach for OCD. <a className="underline text-slate" href="/care">Find care</a></p>
              </>
            )}
            {data && I.total > 0 && kind === "panic_episode" && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center"><div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.thisWeek) || 0} /></p><p className="text-[12px] text-ink2">This week</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.avgIntensity) || 0} decimals={1} /></p><p className="text-[12px] text-ink2">Avg intensity</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.avgMinutes) || 0} decimals={1} /></p><p className="text-[12px] text-ink2">Avg minutes</p></div></div>
                <div><p className="eyebrow mb-1">How long episodes lasted</p><Spark data={I.minutesTrend ?? []} max={Math.max(10, ...(I.minutesTrend ?? [0]))} /></div>
                {I.helped?.length > 0 && <div><p className="eyebrow">What helped most</p><div className="mt-1 flex flex-wrap gap-1.5">{I.helped.map((t: any) => <span key={t.name} className="tag tag-sage">{t.name} · {t.n}</span>)}</div></div>}
              </>
            )}
            {data && I.total > 0 && kind === "daily" && (
              <>
                <div className="grid grid-cols-2 gap-2 text-center"><div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.avgMood) || 0} decimals={1} /></p><p className="text-[12px] text-ink2">Avg mood (1 to 5)</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]"><Count to={Number(I.avgAnxiety) || 0} decimals={1} /></p><p className="text-[12px] text-ink2">Avg anxiety (0 to 10)</p></div></div>
                <div><p className="eyebrow mb-1">Anxiety over time</p><Spark data={I.anxietyTrend ?? []} max={10} color="#B85D43" /></div>
                {I.helped?.length > 0 && <div><p className="eyebrow">What helped most</p><div className="mt-1 flex flex-wrap gap-1.5">{I.helped.map((t: any) => <span key={t.name} className="tag tag-sage">{t.name} · {t.n}</span>)}</div></div>}
              </>
            )}
          </article>

          {data && data.logs.length > 0 && (
            <details className="card p-5"><summary className="cursor-pointer font-medium">Recent entries</summary><div className="mt-3 space-y-2">
              {data.logs.slice(0, 8).map((l) => (
                <div key={l.id} className="card-flat p-3 flex items-start justify-between gap-3"><div className="text-[14px]"><p className="text-[12px] text-ink2">{when(l.created_at)}</p>
                  {kind === "ocd_urge" && <p><b>{l.data.response === "did" ? "Did it" : l.data.response === "delayed" ? `Delayed${l.data.delay_min ? ` ${l.data.delay_min} min` : ""}` : "Resisted"}</b> · {l.data.urge} · {l.data.trigger}</p>}
                  {kind === "panic_episode" && <p><b>Intensity {l.data.intensity}</b> · {l.data.minutes} min{l.data.helped?.length ? ` · helped: ${l.data.helped.join(", ")}` : ""}</p>}
                  {kind === "daily" && <p><b>Mood {l.data.mood}/5</b> · anxiety {l.data.anxiety}/10{l.data.sleep ? ` · slept ${l.data.sleep}` : ""}</p>}</div>
                  <button onClick={() => del(l.id)} className="text-[12.5px] text-terra underline min-h-10">Delete</button></div>
              ))}
            </div></details>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
