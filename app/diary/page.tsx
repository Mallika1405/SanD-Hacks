"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Seg = { text: string; pause_ms: number; sig: string };
type Draft = { title: string; summary: string; heard: string; feelings: string[]; themes: string[]; quote: string; intensity: number };
type Entry = { id: string; created_at: string; title: string; summary: string; heard: string; feelings: string[]; themes: string[]; intensity: number | null; quote: string | null; has_transcript: boolean };

const b64url = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Diary() {
  const [phase, setPhase] = useState<"idle" | "listening" | "paused" | "working" | "review">("idle");
  const [secs, setSecs] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [sttOk, setSttOk] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [reflectOn, setReflectOn] = useState(false);
  const [keep, setKeep] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftSay, setDraftSay] = useState<Seg[]>([]);
  const [data, setData] = useState<{ entries: Entry[]; patterns: any; listen: Seg[] } | null>(null);
  const [obs, setObs] = useState("");
  const [crisis, setCrisis] = useState<null | "self_harm" | "medical">(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [speakingNow, setSpeakingNow] = useState(false);

  const rec = useRef<any>(null);
  const want = useRef(false);
  const lastResult = useRef(0);
  const lastBack = useRef(0);
  const echoUntil = useRef(0);
  const lastReflectLen = useRef(0);
  const lastCheckLen = useRef(0);
  const voice = useRef("EXAVITQu4vr4xnSDxMaL");
  const wordsRef = useRef<string[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const soundsRef = useRef(true); soundsRef.current = sounds;
  const reflectRef = useRef(false); reflectRef.current = reflectOn;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const listenRef = useRef<Seg[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => fetch("/api/diary").then((r) => r.json()).then((j) => { setData(j); listenRef.current = j.listen ?? []; }).catch(() => {}), []);
  useEffect(() => {
    load();
    fetch("/api/voices").then((r) => r.json()).then((j) => (voice.current = j.selected.id)).catch(() => {});
    if (!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) setSttOk(false);
    return () => { want.current = false; try { rec.current?.stop(); } catch {} };
  }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4000); };

  const say = (s: Seg, vol = 0.8) => {
    try {
      audio.current?.pause();
      const a = new Audio(`/api/sos/tts?t=${b64url(s.text)}&s=${s.sig}&v=${voice.current}`); a.volume = vol; audio.current = a;
      echoUntil.current = Date.now() + 2500 + s.text.length * 80;
      setSpeakingNow(true); a.onended = () => setSpeakingNow(false); a.onerror = () => setSpeakingNow(false);
      a.play().catch(() => setSpeakingNow(false));
    } catch {}
  };

  /* ---- timer + gentle listener ---- */
  useEffect(() => {
    if (phase !== "listening") return;
    const t = setInterval(() => {
      setSecs((s) => s + 1);
      const now = Date.now();
      // a quiet "mm" only after a real pause, and not too often
      if (soundsRef.current && now - lastResult.current > 6500 && now - lastBack.current > 30000 && wordsRef.current.length > 0 && listenRef.current.length) {
        lastBack.current = now; say(listenRef.current[Math.floor(Math.random() * listenRef.current.length)], 0.55);
      }
      // silent safety check as she talks: if she says something alarming, help appears right away (no waiting for the end)
      if (total - lastCheckLen.current > 40 && now - lastResult.current > 1500) { lastCheckLen.current = total; safetyCheck(); }
      // optional: one short reflection after she has said a good amount
      const total = wordsRef.current.join(" ").split(/\s+/).length;
      if (reflectRef.current && now - lastResult.current > 3500 && total - lastReflectLen.current > 60) {
        lastReflectLen.current = total; reflect();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function safetyCheck() {
    const text = wordsRef.current.join(" ").split(/\s+/).slice(-60).join(" ");
    const j = await fetch("/api/diary/reflect", { method: "POST", body: JSON.stringify({ text, silent: true }) }).then((r) => r.json()).catch(() => null);
    if (j?.crisis) setCrisis(j.crisis);
  }

  async function reflect() {
    const text = wordsRef.current.join(" ").split(/\s+/).slice(-90).join(" ");
    const j = await fetch("/api/diary/reflect", { method: "POST", body: JSON.stringify({ text }) }).then((r) => r.json()).catch(() => null);
    if (j?.crisis) { setCrisis(j.crisis); return; }
    if (j?.say?.[0] && phaseRef.current === "listening") say(j.say[0], 0.85);
  }

  /* ---- speech recognition ---- */
  const startRec = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSttOk(false); return; }
    if (rec.current) return;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => {
      if (Date.now() < echoUntil.current) return; // ignore our own quiet voice
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], tr = String(res[0].transcript).trim();
        if (!tr) continue;
        lastResult.current = Date.now();
        if (res.isFinal) { wordsRef.current = [...wordsRef.current, tr]; setWords(wordsRef.current); } else live = tr;
      }
      setInterim(live);
      scroller.current?.scrollTo({ top: 1e6 });
    };
    r.onerror = (e: any) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setSttOk(false); want.current = false; setErr("The microphone is blocked. You can type instead."); } };
    r.onend = () => { rec.current = null; if (want.current) setTimeout(() => startRec(), 200); };
    try { r.start(); rec.current = r; want.current = true; } catch {}
  }, []);
  const stopRec = () => { want.current = false; try { rec.current?.stop(); } catch {} rec.current = null; };

  function begin() {
    setErr(""); setDraft(null); setSecs(0); wordsRef.current = []; setWords([]); setInterim(""); lastResult.current = Date.now(); lastBack.current = Date.now(); lastReflectLen.current = 0; lastCheckLen.current = 0;
    setPhase("listening"); startRec();
  }
  function pause() { stopRec(); setInterim(""); setPhase("paused"); }
  function resume() { setPhase("listening"); lastResult.current = Date.now(); startRec(); }

  async function finish() {
    stopRec(); audio.current?.pause();
    const transcript = (wordsRef.current.join(" ") + " " + interim + " " + typed).replace(/\s+/g, " ").trim();
    if (transcript.length < 20) { setPhase("idle"); setErr("I didn't catch enough to reflect on. Try again, or type it."); return; }
    setPhase("working"); setErr("");
    const r = await fetch("/api/diary/finish", { method: "POST", body: JSON.stringify({ transcript }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setPhase("idle"); setErr(j.error ?? "Something went wrong."); return; }
    setDraft(j.draft); setDraftSay(j.say ?? []); setPhase("review");
    if (j.crisis) setCrisis(j.crisis);
  }

  async function save() {
    if (!draft) return;
    const transcript = keep ? (wordsRef.current.join(" ") + " " + typed).trim().slice(0, 20000) : null;
    const r = await fetch("/api/diary/save", { method: "POST", body: JSON.stringify({ ...draft, transcript, duration_s: secs }) });
    if (!r.ok) return setErr("I couldn't save that. Please try again.");
    setDraft(null); setPhase("idle"); setTyped(""); wordsRef.current = []; setWords([]); flash("Saved to your diary."); load();
  }
  const discard = () => { setDraft(null); setPhase("idle"); setTyped(""); wordsRef.current = []; setWords([]); flash("Discarded. Nothing was saved."); };
  async function remove(id: string) { if (!confirm("Delete this entry? This can't be undone.")) return; await fetch(`/api/diary?id=${id}`, { method: "DELETE" }); load(); }
  async function observe() { setObs("Looking across your entries…"); const j = await fetch("/api/diary/observe", { method: "POST" }).then((r) => r.json()).catch(() => null); setObs(j?.text ?? "I couldn't do that just now."); }

  const trend: number[] = (data?.patterns.trend ?? []).map((t: any) => t.intensity);
  const spark = trend.length > 1 ? trend.map((v, i) => `${(i / (trend.length - 1)) * 220},${46 - (v / 10) * 42}`).join(" ") : "";
  const live = phase === "listening";

  return (
    <div className="space-y-8 fade-in">
      <section className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-end">
        <div>
          <span className="tag">Voice Diary</span>
          <h1 className="mt-3 text-[2.6rem] lg:text-[3.2rem] leading-[1.08]">Say it all. I'll just listen.</h1>
          <p className="mt-3 text-ink2 prose-narrow">This isn't a chat. I won't interrupt, argue, or tell you what to do. I'll listen, say very little, and when you're done I'll show you what I heard, in your own words, so you can keep it or let it go.</p>
        </div>
        <ul className="card-flat p-5 text-[14px] text-ink2 space-y-1.5">
          <li><b className="text-ink">Listens, doesn't reply.</b> Only a quiet "mm" when you pause.</li>
          <li><b className="text-ink">Reflects, doesn't advise.</b> It shows you what it heard.</li>
          <li><b className="text-ink">Notices over time.</b> Themes and patterns across entries.</li>
          <li><b className="text-ink">Yours to delete.</b> Nothing is saved unless you tap Save.</li>
        </ul>
      </section>

      <div className="grid lg:grid-cols-[1.45fr_1fr] gap-6 items-start">
        {/* ---------- recorder ---------- */}
        <section className="card p-6 lg:p-7 space-y-5" aria-label="Recorder">
          <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[14.5px] font-medium"><i className={`size-2.5 rounded-full ${live ? "bg-terra animate-pulse" : "bg-stone-2"}`} style={{ background: live ? undefined : "#CFC9BB" }} />{live ? "Listening" : phase === "paused" ? "Paused" : phase === "working" ? "Putting it together…" : phase === "review" ? "Here's what I heard" : "Ready when you are"}</p>
            <span className="tag tag-stone">{mmss(secs)}</span></div>

          <div className={`bc ${live ? "" : "paused"}`} aria-hidden style={{ width: 220, height: 220 }}>
            <i className="r r1" /><i className="r r2" /><i className="r r3" />
            <div className="core" style={{ transform: live ? undefined : "scale(.94)" }}><div><p className="serif text-[1.25rem] leading-tight">{live ? (speakingNow ? "Mm." : "I'm here") : phase === "review" ? "Done" : "Whenever"}</p></div></div>
          </div>

          {phase === "idle" && (
            <div className="space-y-3">
              {sttOk ? <button onClick={begin} className="b b-primary w-full !min-h-[56px] text-[17px]">Start talking</button>
                : <div className="space-y-2"><p className="text-[14px] text-ink2">I can't hear you in this browser (Chrome works best), so you can type or paste instead.</p>
                    <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={6} placeholder="Write whatever's on your mind. Nobody's grading it." />
                    <button onClick={finish} disabled={typed.trim().length < 20} className="b b-primary w-full">Show me what you heard</button></div>}
            </div>
          )}
          {(live || phase === "paused") && (
            <div className="grid grid-cols-2 gap-2">
              {live ? <button onClick={pause} className="b b-soft border border-line">Pause</button> : <button onClick={resume} className="b b-soft border border-line">Keep going</button>}
              <button onClick={finish} className="b b-primary">I'm done</button>
            </div>
          )}

          {(live || phase === "paused") && (
            <div ref={scroller} className="card-flat p-4 max-h-56 overflow-y-auto" aria-live="off">
              <p className="eyebrow mb-1">Your words (only on this screen)</p>
              <p className="text-[1.02rem] leading-relaxed text-ink2">{words.join(" ")} <span className="text-ink">{interim}</span>{!words.length && !interim && <span className="text-ink2/60">Start whenever you like…</span>}</p>
            </div>
          )}
          {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}

          <div className="grid sm:grid-cols-3 gap-2 text-[14px]">
            {([["Quiet listening sounds", sounds, setSounds], ["Reflect back about once a minute", reflectOn, setReflectOn], ["Keep the full transcript", keep, setKeep]] as const).map(([l, v, set]) => (
              <button key={l} role="switch" aria-checked={v} onClick={() => set(!v)} className="check-row !min-h-[44px]"><span className="box">{v && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span>{l}</span></button>
            ))}
          </div>
          <p className="text-[12.5px] text-ink2">By default only a short summary is saved, and only if you choose to. The full transcript is kept only if you switch that on. If you say something that sounds like you might be in danger, I'll show you where to get help right away.</p>
        </section>

        {/* ---------- patterns ---------- */}
        <aside className="space-y-6">
          <article className="card p-6">
            <h2 className="text-[1.5rem]">Over time</h2>
            {!data?.entries.length ? <p className="mt-2 text-[14.5px] text-ink2">Once you've saved a few entries, I'll show the themes and feelings that keep coming up.</p> : (
              <div className="mt-3 space-y-4">
                <div><p className="eyebrow">Recurring themes</p>
                  <ul className="mt-2 space-y-1.5">{data.patterns.themes.map((t: any) => <li key={t.name} className="flex items-center gap-2 text-[14.5px]"><span className="w-24 truncate">{t.name}</span><span className="h-2 rounded-full bg-sage/70" style={{ width: `${Math.min(100, t.n * 22)}px` }} /><span className="text-ink2 text-[13px]">{t.n}</span></li>)}{!data.patterns.themes.length && <li className="text-[14px] text-ink2">None yet.</li>}</ul></div>
                <div><p className="eyebrow">Feelings you named</p><div className="mt-2 flex flex-wrap gap-1.5">{data.patterns.feelings.map((f: any) => <span key={f.name} className="tag tag-sage">{f.name} · {f.n}</span>)}</div></div>
                {spark && <div><p className="eyebrow">How intense it felt</p><svg viewBox="0 0 220 50" className="w-full mt-1"><polyline fill="none" stroke="#2F5D50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={spark} /></svg><p className="text-[12px] text-ink2">Your own 1 to 10 ratings, oldest to newest. Self-reported, not clinical.</p></div>}
                <button onClick={observe} className="b b-ghost w-full">What do you notice?</button>
                {obs && <p className="card-flat p-4 text-[14.5px] text-ink2">{obs}</p>}
              </div>
            )}
          </article>
          <article className="card-flat p-5 text-[14px] text-ink2"><p className="font-semibold text-ink">Prefer to be guided?</p><p className="mt-1">If it's loud in your head right now, start with <a className="underline text-slate" href="/?sos=1">a guided grounding</a> first. The diary will be here after.</p></article>
        </aside>
      </div>

      {/* ---------- review ---------- */}
      {phase === "review" && draft && (
        <section className="card p-6 lg:p-8 space-y-5 fade-in" aria-label="What I heard">
          <div><p className="eyebrow">What I heard</p><p className="serif mt-2 text-[1.5rem] leading-snug prose-narrow">{draft.heard}</p>
            {draftSay[0] && <button onClick={() => say(draftSay[0] as Seg, 0.95)} className="b b-soft border border-line mt-3">Read it to me</button>}</div>
          <div className="divider pt-5 grid lg:grid-cols-2 gap-5">
            <div className="space-y-3"><label className="block"><span className="eyebrow">Title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1" /></label>
              <label className="block"><span className="eyebrow">Summary (edit anything that's off)</span><textarea rows={5} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="mt-1" /></label>
              {draft.quote && <p className="text-[14.5px] text-ink2 italic">“{draft.quote}”</p>}</div>
            <div className="space-y-4">
              <div><p className="eyebrow">Feelings</p><div className="mt-2 flex flex-wrap gap-2">{draft.feelings.map((f) => <button key={f} className="chip" onClick={() => setDraft({ ...draft, feelings: draft.feelings.filter((x) => x !== f) })} aria-label={`Remove ${f}`}>{f} ×</button>)}</div></div>
              <div><p className="eyebrow">Themes</p><div className="mt-2 flex flex-wrap gap-2">{draft.themes.map((f) => <button key={f} className="chip" onClick={() => setDraft({ ...draft, themes: draft.themes.filter((x) => x !== f) })} aria-label={`Remove ${f}`}>{f} ×</button>)}</div></div>
              <label className="block"><span className="eyebrow">How intense did it feel? {draft.intensity} / 10</span><input type="range" min={1} max={10} value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) })} className="!min-h-0 !p-0 !border-0 !bg-transparent accent-[#2F5D50]" /></label>
            </div>
          </div>
          <div className="flex flex-wrap gap-3"><button onClick={save} className="b b-primary">Save to my diary</button><button onClick={discard} className="b b-ghost">Discard, save nothing</button></div>
        </section>
      )}
      {phase === "working" && <p className="card-flat p-5 text-ink2" role="status">Putting together what you said…</p>}
      {toast && <p role="status" className="text-sage font-medium">{toast}</p>}

      {/* ---------- entries ---------- */}
      <section className="space-y-4" aria-label="Past entries">
        <h2 className="text-[1.9rem]">Your entries</h2>
        {!data && <p className="text-ink2">Loading…</p>}
        {data && !data.entries.length && <p className="card-flat p-5 text-ink2">Nothing saved yet. When you're ready, tap Start talking.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {data?.entries.map((e) => (
            <article key={e.id} className="card p-5 space-y-2">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[12.5px] text-ink2">{when(e.created_at)}</p><h3 className="text-[1.4rem] leading-tight">{e.title}</h3></div>{e.intensity != null && <span className="tag tag-stone">{e.intensity}/10</span>}</div>
              <p className="text-[14.5px] text-ink2">{e.summary}</p>
              <div className="flex flex-wrap gap-1.5">{e.feelings.map((f) => <span key={f} className="tag tag-sage">{f}</span>)}{e.themes.map((f) => <span key={f} className="tag">{f}</span>)}</div>
              <div className="flex justify-between items-center pt-1"><span className="text-[12px] text-ink2">{e.has_transcript ? "Full transcript kept" : "Summary only"}</span><button onClick={() => remove(e.id)} className="text-[13px] text-terra underline min-h-10">Delete</button></div>
            </article>
          ))}
        </div>
      </section>

      {crisis && (
        <>
          <div className="sheet-back" />
          <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-[70] overflow-y-auto grid place-items-center p-4">
            <div className="card max-w-[520px] w-full p-7 space-y-4">
              <span className="tag tag-terra">Help is here</span>
              <h2 className="text-[2rem] leading-tight">{crisis === "medical" ? "That could be a medical emergency." : "I'm really glad you said that out loud."}</h2>
              <p className="text-ink2">{crisis === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988. It's free, and someone answers day and night."}</p>
              <a href={crisis === "medical" ? "tel:911" : "tel:988"} className="b b-terra w-full !min-h-[56px] text-[17px]">{crisis === "medical" ? "Call 911" : "Call 988"}</a>
              {crisis !== "medical" && <a href="sms:988" className="b b-soft w-full border border-line">Text 988</a>}
              <a href="/crisis" className="b b-ghost w-full">More support options</a>
              <button onClick={() => setCrisis(null)} className="b w-full text-ink2 underline">I'm safe right now</button>
              <p className="text-[12px] text-ink2">Somewhere is a demo and not a medical service or crisis line. It can't call anyone for you.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
