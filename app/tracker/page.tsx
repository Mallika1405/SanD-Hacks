"use client";
import { useCallback, useEffect, useState } from "react";

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
  useEffect(() => { load(kind); setMsg(""); setErr(""); }, [kind, load]);

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
    setTrigger(null); setUrge(null); setResp(null); setWait(null); setNote(""); setHelped([]); load(kind);
  }
  async function del(id: string) { if (!confirm("Delete this entry?")) return; await fetch(`/api/tracker?id=${id}`, { method: "DELETE" }); load(kind); }

  const I = data?.insights ?? {};
  const tab = TABS.find((t) => t.id === kind)!;

  return (
    <div className="space-y-8 fade-in">
      <section className="max-w-[760px]"><span className="tag tag-stone">Tracker · only what you choose to log</span>
        <h1 className="mt-3 text-[2.6rem] lg:text-[3.2rem] leading-[1.08]">See how it's going, gently.</h1>
        <p className="mt-3 text-ink2 prose-narrow">A quick log, and a clear picture over time. No streaks, no guilt for missed days. This is self-tracking, not treatment.</p></section>

      <div className="seg max-w-xl" role="tablist" aria-label="Tracker type">{TABS.map((t) => <button key={t.id} role="tab" aria-pressed={kind === t.id} onClick={() => setKind(t.id)}>{t.label}</button>)}</div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
        {/* ---------- log form ---------- */}
        <section className="card p-6 lg:p-7 space-y-6" aria-label="Log an entry">
          <div><h2 className="text-[1.7rem]">{kind === "ocd_urge" ? "Log an urge" : kind === "panic_episode" ? "Log a panic episode" : "How is today?"}</h2><p className="text-[14.5px] text-ink2">{tab.sub}. Takes under a minute.</p></div>

          {kind === "ocd_urge" && (
            <>
              <div className="space-y-2"><h3 className="text-[1.1rem]">What set it off?</h3><Chips opts={TRIGGERS} val={trigger} onPick={setTrigger} /></div>
              <div className="space-y-2"><h3 className="text-[1.1rem]">What did the urge tell you to do?</h3><Chips opts={URGES} val={urge} onPick={setUrge} /></div>
              <div className="space-y-2"><h3 className="text-[1.1rem]">What did you do?</h3>
                <div className="grid sm:grid-cols-3 gap-2">{([["did", "I did it", "That's okay. Just log it."], ["delayed", "I delayed it", "Waited before giving in"], ["resisted", "I resisted fully", "Didn't do it at all"]] as const).map(([k, t, s]) => (
                  <button key={k} type="button" aria-pressed={resp === k} onClick={() => setResp(k)} className={`text-left rounded-xl p-3.5 border ${resp === k ? "bg-mint/50 border-sage" : "bg-cream border-line"}`}><span className="block font-semibold">{t}</span><span className="block text-[13px] text-ink2">{s}</span></button>))}</div></div>
              {resp === "delayed" && <div className="space-y-2"><h3 className="text-[1.1rem]">How long did you wait?</h3><Chips opts={WAITS.map((w) => `${w} min`)} val={wait ? `${wait} min` : null} onPick={(v) => setWait(v ? parseInt(v) : null)} /></div>}
              <div className="grid sm:grid-cols-2 gap-5"><Slider label="Distress before" v={before} set={setBefore} /><Slider label="Distress after" v={after} set={setAfter} /></div>
              <label className="block"><span className="text-[14px] text-ink2">Anything you want to remember (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} className="mt-1" /></label>
            </>
          )}
          {kind === "panic_episode" && (
            <>
              <Slider label="How intense did it get?" v={intensity} set={setIntensity} />
              <div className="space-y-2"><h3 className="text-[1.1rem]">About how long did it last?</h3><Chips opts={MIN_OPTS.map((m) => `${m} min`)} val={mins ? `${mins} min` : null} onPick={(v) => setMins(v ? parseInt(v) : null)} /></div>
              <div className="space-y-2"><h3 className="text-[1.1rem]">Any trigger?</h3><Chips opts={P_TRIG} val={pTrig} onPick={setPTrig} /></div>
              <div className="space-y-2"><h3 className="text-[1.1rem]">What helped?</h3><Multi opts={HELPED} val={helped} onPick={setHelped} /></div>
            </>
          )}
          {kind === "daily" && (
            <>
              <div className="space-y-2"><h3 className="text-[1.1rem]">Mood</h3><div className="seg">{MOOD.map((m, i) => <button key={m} type="button" aria-pressed={mood === i} onClick={() => setMood(i)}>{m}</button>)}</div></div>
              <Slider label="Anxiety today" v={anx} set={setAnx} />
              <div className="space-y-2"><h3 className="text-[1.1rem]">Sleep last night</h3><Chips opts={SLEEP} val={sleep} onPick={setSleep} /></div>
              <div className="space-y-2"><h3 className="text-[1.1rem]">What helped?</h3><Multi opts={HELPED} val={helped} onPick={setHelped} /></div>
            </>
          )}
          {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
          <button onClick={save} disabled={busy} className="b b-primary">{busy ? "Saving…" : "Save entry"}</button>
          {msg && <p role="status" className="card-flat p-4 text-sage font-medium">{msg}</p>}
        </section>

        {/* ---------- insights ---------- */}
        <aside className="space-y-6">
          <article className="card p-6 space-y-4">
            <h2 className="text-[1.6rem]">Over time</h2>
            {!data && <p className="text-ink2">Loading…</p>}
            {data && !I.total && <p className="text-[14.5px] text-ink2">Nothing logged yet. Your first entry starts the picture.</p>}
            {data && I.total > 0 && kind === "ocd_urge" && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.resisted}</p><p className="text-[12px] text-ink2">Resisted</p></div>
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.delayed}</p><p className="text-[12px] text-ink2">Delayed</p></div>
                  <div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.did}</p><p className="text-[12px] text-ink2">Did it</p></div>
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
                <div className="grid grid-cols-3 gap-2 text-center"><div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.thisWeek}</p><p className="text-[12px] text-ink2">This week</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.avgIntensity}</p><p className="text-[12px] text-ink2">Avg intensity</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.avgMinutes}</p><p className="text-[12px] text-ink2">Avg minutes</p></div></div>
                <div><p className="eyebrow mb-1">How long episodes lasted</p><Spark data={I.minutesTrend ?? []} max={Math.max(10, ...(I.minutesTrend ?? [0]))} /></div>
                {I.helped?.length > 0 && <div><p className="eyebrow">What helped most</p><div className="mt-1 flex flex-wrap gap-1.5">{I.helped.map((t: any) => <span key={t.name} className="tag tag-sage">{t.name} · {t.n}</span>)}</div></div>}
              </>
            )}
            {data && I.total > 0 && kind === "daily" && (
              <>
                <div className="grid grid-cols-2 gap-2 text-center"><div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.avgMood}</p><p className="text-[12px] text-ink2">Avg mood (1 to 5)</p></div><div className="card-flat p-3"><p className="serif text-[1.8rem]">{I.avgAnxiety}</p><p className="text-[12px] text-ink2">Avg anxiety (0 to 10)</p></div></div>
                <div><p className="eyebrow mb-1">Anxiety over time</p><Spark data={I.anxietyTrend ?? []} max={10} color="#B85D43" /></div>
                {I.helped?.length > 0 && <div><p className="eyebrow">What helped most</p><div className="mt-1 flex flex-wrap gap-1.5">{I.helped.map((t: any) => <span key={t.name} className="tag tag-sage">{t.name} · {t.n}</span>)}</div></div>}
              </>
            )}
          </article>

          {data && data.logs.length > 0 && (
            <article className="card p-6 space-y-2"><h2 className="text-[1.4rem]">Recent entries</h2>
              {data.logs.slice(0, 8).map((l) => (
                <div key={l.id} className="card-flat p-3 flex items-start justify-between gap-3"><div className="text-[14px]"><p className="text-[12px] text-ink2">{when(l.created_at)}</p>
                  {kind === "ocd_urge" && <p><b>{l.data.response === "did" ? "Did it" : l.data.response === "delayed" ? `Delayed${l.data.delay_min ? ` ${l.data.delay_min} min` : ""}` : "Resisted"}</b> · {l.data.urge} · {l.data.trigger}</p>}
                  {kind === "panic_episode" && <p><b>Intensity {l.data.intensity}</b> · {l.data.minutes} min{l.data.helped?.length ? ` · helped: ${l.data.helped.join(", ")}` : ""}</p>}
                  {kind === "daily" && <p><b>Mood {l.data.mood}/5</b> · anxiety {l.data.anxiety}/10{l.data.sleep ? ` · slept ${l.data.sleep}` : ""}</p>}</div>
                  <button onClick={() => del(l.id)} className="text-[12.5px] text-terra underline min-h-10">Delete</button></div>
              ))}
            </article>
          )}
        </aside>
      </div>
    </div>
  );
}
