"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Seg = { text: string; pause_ms: number; listen?: boolean; sig: string; fb?: string };
type Ui = { crisis?: "self_harm" | "medical"; finish?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean; source?: { name: string; url: string; title: string } };
type CatalogItem = { id: string; title: string; blurb: string; source?: string };
type Out = {
  say: Seg[]; lead: number; exBase: number; state: string; flow: string; exerciseId?: string; exerciseTitle?: string; ui: Ui; research?: { key: string };
  why: { text: string; source?: { name: string; url: string } } | null; anchors: string[];
  catalog: CatalogItem[]; transitions: Seg[]; progress: { block: number; max: number };
};

const TRUST_MSG = "I'm having a hard time right now. Can you stay in touch with me?";
const plain = (t: string) => t.replace(/<break[^>]*\/>/g, " ").replace(/\s+/g, " ").trim();
const norm = (t: string) => plain(t).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const b64url = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const RATES = [["Slower", 0.9], ["Normal", 1], ["Faster", 1.15]] as const;

function phaseOf(caption: string, title: string, status: string) {
  const c = caption.toLowerCase();
  if (/breathe in|in through your nose/.test(c)) return { t: "Inhale (Nose)", s: "Slow and gentle" };
  if (/little more air|second small|sip/.test(c)) return { t: "A second sip", s: "Top it off" };
  if (/breath out|let it out|exhale/.test(c)) return { t: "Exhale (Mouth)", s: "Slow, soft release…" };
  return { t: title || "Starting", s: status };
}

export default function Guide({ sessionId, first, onExit }: { sessionId: string; first?: string | null; onExit: () => void }) {
  const [caption, setCaption] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [mode, setMode] = useState<"speaking" | "listening" | "paused" | "idle">("idle");
  const [crisis, setCrisis] = useState<"self_harm" | "medical" | null>(null);
  const [ui, setUi] = useState<Ui>({});
  const [title, setTitle] = useState("");
  const [exId, setExId] = useState("");
  const [paused, setPaused] = useState(false);
  const [sttOk, setSttOk] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [toast, setToast] = useState("");
  const [typed, setTyped] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [tech, setTech] = useState<{ status: string | null; items: { title: string; source_name: string; source_url: string }[] }>({ status: null, items: [] });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [why, setWhy] = useState<Out["why"]>(null);
  const [anchors, setAnchors] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState({ block: 0, max: 8 });
  const [rate, setRate] = useState(1);
  const [voiceOn, setVoiceOn] = useState(true);

  const audio = useRef<HTMLAudioElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const epoch = useRef(0);
  const voice = useRef("EXAVITQu4vr4xnSDxMaL");
  const speakingText = useRef("");
  const speaking = useRef(false);
  const spokenIdx = useRef(-1);
  const interrupted = useRef(false);
  const busy = useRef(false);
  const rec = useRef<any>(null);
  const wantListen = useRef(false);
  const firstOut = useRef<Out | null>(null);
  const echoUntil = useRef(0);
  const actx = useRef<AudioContext | null>(null);
  const pollOn = useRef(false);
  const transRef = useRef<Seg[]>([]);
  const rateRef = useRef(1);
  const voiceOnRef = useRef(true);
  const lastEx = useRef("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 5000); };

  useEffect(() => {
    try { const r = Number(localStorage.getItem("sw_rate")); if (r) { setRate(r); rateRef.current = r; } if (localStorage.getItem("sw_voice") === "off") { setVoiceOn(false); voiceOnRef.current = false; } } catch {}
  }, []);
  const changeRate = (r: number) => { setRate(r); rateRef.current = r; if (audio.current) audio.current.playbackRate = r; try { localStorage.setItem("sw_rate", String(r)); } catch {} };
  const changeVoiceOn = (on: boolean) => { setVoiceOn(on); voiceOnRef.current = on; if (audio.current) audio.current.muted = !on; try { localStorage.setItem("sw_voice", on ? "on" : "off"); } catch {} };

  /* ---------- trusted-source research status ---------- */
  const startPoll = () => {
    if (pollOn.current) return; pollOn.current = true; let n = 0;
    setTech((t) => ({ ...t, status: "pending" }));
    const iv = setInterval(async () => {
      n++;
      const j = await fetch(`/api/sos/techniques?session=${sessionId}`).then((r) => r.json()).catch(() => null);
      if (j) setTech(j);
      if (n >= 24 || (j && j.status && j.status !== "pending")) { clearInterval(iv); pollOn.current = false; }
    }, 3500);
  };

  /* ---------- audio ---------- */
  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const a = new Audio(); a.preload = "auto"; a.playbackRate = rateRef.current; a.muted = !voiceOnRef.current; audio.current = a;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); actx.current = ctx;
      const source = ctx.createMediaElementSource(a), an = ctx.createAnalyser(); an.fftSize = 256;
      source.connect(an); an.connect(ctx.destination);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        root.current?.style.setProperty("--lvl", String(Math.min(1, Math.sqrt(sum / buf.length) * 4)));
        requestAnimationFrame(loop);
      };
      loop();
    } catch {}
    return a;
  };

  const playSrc = (url: string, my: number): Promise<"ok" | "fail" | "int" | "blocked"> =>
    new Promise((res) => {
      const a = ensureAudio(); let done = false; let started = false; let endTimer: any;
      const end = (r: "ok" | "fail" | "int" | "blocked") => {
        if (done) return; done = true; clearInterval(iv); clearTimeout(startDog); clearTimeout(endTimer);
        a.onended = null; a.onerror = null; a.onplaying = null; a.onloadedmetadata = null; res(r);
      };
      const iv = setInterval(() => { if (epoch.current !== my) { try { a.pause(); } catch {} end("int"); } }, 50);
      const startDog = setTimeout(() => { if (!started) { try { a.pause(); } catch {} end("blocked"); } }, 4500);
      a.onplaying = () => { started = true; clearTimeout(startDog); };
      a.onloadedmetadata = () => { if (isFinite(a.duration)) endTimer = setTimeout(() => end("ok"), (a.duration / rateRef.current) * 1000 + 1500); };
      a.onended = () => end("ok"); a.onerror = () => end("fail");
      a.src = url; a.playbackRate = rateRef.current; a.muted = !voiceOnRef.current;
      actx.current?.resume().catch(() => {});
      a.play().catch((e) => end(e?.name === "NotAllowedError" ? "blocked" : "fail"));
    });

  const sleep = (ms: number, my: number) => new Promise<void>((res) => { const t0 = Date.now(); const iv = setInterval(() => { if (epoch.current !== my || Date.now() - t0 >= ms / rateRef.current) { clearInterval(iv); res(); } }, 60); });
  const urlOf = (s: Seg) => `/api/sos/tts?t=${b64url(s.text)}&s=${s.sig}&v=${voice.current}`;
  const warm = (s?: Seg) => { if (s) fetch(urlOf(s)).then((r) => r.arrayBuffer()).catch(() => {}); }; // load upcoming lines ahead of time

  const showCaption = (t0: string) => { const t = plain(t0); setCaption(t); setLines((l) => (l[l.length - 1] === t ? l : [...l.slice(-3), t])); };

  const speak = async (s: Seg, my: number) => {
    showCaption(s.text); setMode("speaking"); speaking.current = true; speakingText.current = norm(s.text);
    let r = await playSrc(urlOf(s), my);
    if (r === "blocked") { speaking.current = false; return "blocked" as const; }
    if (r === "fail" && s.fb) r = await playSrc(s.fb, my);
    if (r === "fail") await sleep(Math.min(5000, 600 + s.text.length * 45), my);
    speaking.current = false; echoUntil.current = Date.now() + 1200;
    return r;
  };

  const turnCall = async (body: any): Promise<Out | null> => {
    try {
      const r = await fetch("/api/sos/turn", { method: "POST", body: JSON.stringify({ sessionId, ...body }) });
      if (!r.ok) throw new Error();
      return await r.json();
    } catch { return null; }
  };

  const play = useCallback(async (out: Out): Promise<boolean> => {
    const my = ++epoch.current;
    for (let i = 0; i < out.say.length; i++) {
      if (epoch.current !== my) return false;
      const s = out.say[i];
      spokenIdx.current = i < out.lead ? out.exBase - 1 : out.exBase + (i - out.lead);
      warm(out.say[i + 1]); warm(out.say[i + 2]);
      const r = await speak(s, my);
      if (r === "blocked") { setNeedsTap(true); return false; }
      if (epoch.current !== my) return false;
      interrupted.current = false; setMode("listening");
      await sleep(s.pause_ms, my);
    }
    return epoch.current === my;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOut = useCallback(async (out: Out) => {
    if (out.exerciseTitle) setTitle(out.exerciseTitle);
    if (out.exerciseId) {
      setExId(out.exerciseId);
      if (out.exerciseId !== lastEx.current) { lastEx.current = out.exerciseId; setChecked({}); }
    }
    setWhy(out.why ?? null); setAnchors(out.anchors ?? []);
    if (out.catalog) setCatalog(out.catalog);
    if (out.transitions?.length) transRef.current = out.transitions;
    if (out.progress) setProgress(out.progress);
    setUi(out.ui);
    if (out.research) startPoll();
    if (out.ui.crisis) setCrisis(out.ui.crisis);
    if (out.ui.checkinConsent) fetch("/api/checkins", { method: "POST", body: JSON.stringify({ sessionId, hour: new Date().getHours() }) }).catch(() => {});
    const finished = await play(out);
    if (finished && out.state === "support" && out.lead < out.say.length) {
      // The block ended: say a short human line right away while the next block is prepared, so there is never a silent gap.
      const my = epoch.current;
      const t = transRef.current[Math.floor(Math.random() * Math.max(1, transRef.current.length))];
      const [next] = await Promise.all([turnCall({ event: "segments_done" }), t ? speak(t, my) : Promise.resolve()]);
      if (epoch.current === my && next) await handleOut(next);
    }
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopSpeaking = () => { epoch.current++; speaking.current = false; try { audio.current?.pause(); } catch {} };

  const handleUser = useCallback(async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    const wasInterrupted = interrupted.current || speaking.current;
    stopSpeaking(); setMode("listening");
    const out = await turnCall({ text, spoken_idx: spokenIdx.current, interrupted: wasInterrupted });
    busy.current = false;
    if (!out) { showCaption("I'm still here. Breathe in slowly, and let it out."); return; }
    await handleOut(out);
  }, [handleOut]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- listening (browser speech recognition + barge-in) ---------- */
  const isEcho = (tr: string) => {
    if (!speakingText.current && Date.now() > echoUntil.current) return false;
    const n = norm(tr); if (!n) return true;
    const sp = speakingText.current; if (sp && sp.includes(n)) return true;
    const w = n.split(" "), set = new Set(sp.split(" "));
    return sp !== "" && w.filter((x) => set.has(x)).length / w.length >= 0.7;
  };
  const startRec = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSttOk(false); return; }
    if (rec.current) return;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], tr = String(res[0].transcript).trim();
        if (!tr || isEcho(tr)) continue;
        if (!res.isFinal) { if (speaking.current && tr.length > 2) { interrupted.current = true; stopSpeaking(); setMode("listening"); } }
        else handleUser(tr);
      }
    };
    r.onerror = (e: any) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setSttOk(false); wantListen.current = false; } };
    r.onend = () => { rec.current = null; if (wantListen.current) setTimeout(() => startRec(), 200); };
    try { r.start(); rec.current = r; wantListen.current = true; } catch {}
  }, [handleUser]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopRec = () => { wantListen.current = false; try { rec.current?.stop(); } catch {} rec.current = null; };

  /* ---------- lifecycle ---------- */
  const begin = useCallback(async () => {
    setNeedsTap(false);
    if (firstOut.current) { await handleOut(firstOut.current); return; }
    const out = await turnCall(first ? { event: "choose", exId: first } : { event: "start" });
    if (!out) { showCaption("I'm here. Breathe in slowly, and let it out."); return; }
    firstOut.current = out;
    await handleOut(out);
  }, [handleOut]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/voices").then((r) => r.json()).then((j) => { voice.current = j.selected.id; setVoiceName(j.selected.kind === "clone" ? j.selected.name : ""); }).catch(() => {}).finally(() => { begin(); startRec(); });
    return () => { epoch.current++; stopRec(); try { audio.current?.pause(); } catch {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- actions ---------- */
  const togglePause = async () => {
    if (!paused) { stopSpeaking(); stopRec(); setPaused(true); setMode("paused"); showCaption("Paused. Tap resume when you're ready."); }
    else { setPaused(false); startRec(); const out = await turnCall({ event: "resume", spoken_idx: spokenIdx.current, interrupted: true }); if (out) await handleOut(out); }
  };
  const okayNow = async () => { stopSpeaking(); const out = await turnCall({ event: "okay_now" }); if (out) await handleOut(out); };
  const helpNow = async () => { stopSpeaking(); setCrisis("self_harm"); const out = await turnCall({ event: "help_now" }); if (out) await handleOut(out); };
  const safeNow = async () => { setCrisis(null); const out = await turnCall({ event: "safe_now" }); if (out) await handleOut(out); };
  const choose = async (id: string) => { stopSpeaking(); setPaused(false); startRec(); const out = await turnCall({ event: "choose", exId: id }); if (out) await handleOut(out); };
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text: TRUST_MSG }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(TRUST_MSG); flash("Copied. Paste it to someone you trust."); } catch { flash(TRUST_MSG); }
  };
  const say = (t: string) => handleUser(t);
  const consentCheckin = async () => {
    await fetch("/api/checkins", { method: "POST", body: JSON.stringify({ sessionId, hour: new Date().getHours() }) }).catch(() => {});
    flash("Okay. I'll check in tomorrow, and remember what helped today.");
  };

  const pace = exId === "exhale-breath" && mode !== "paused";
  const status = paused ? "Paused" : mode === "speaking" ? "Speaking" : mode === "listening" ? (sttOk ? "Listening" : "Waiting") : "Starting";
  const ph = phaseOf(caption, title, status);
  const names = [...new Set(tech.items.map((i) => i.source_name))];
  const bars = [0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.8, 1, 0.6, 0.9, 0.5];

  return (
    <div ref={root} style={{ ["--lvl" as any]: 0 }} className="grid lg:grid-cols-[1.45fr_1fr] gap-6 items-start fade-in">
      {/* ---------- player ---------- */}
      <section className="card p-5 lg:p-7" aria-label="Guided grounding">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[14.5px] font-medium"><i className="size-2.5 rounded-full bg-sage" aria-hidden />{title || "Starting"}</p>
          <div className="flex items-center gap-2">
            <span className="tag" aria-label={`Step ${Math.min(progress.block + 1, progress.max)} of ${progress.max}`}>Step {Math.min(progress.block + 1, progress.max)} of {progress.max}</span>
            {voiceName && <span className="tag tag-sage">{voiceName}'s voice</span>}
          </div>
        </div>

        <div className={`bc mt-6 ${pace ? "pace" : ""} ${paused ? "paused" : ""}`} aria-hidden>
          <i className="r r1" /><i className="r r2" /><i className="r r3" />
          <div className="core"><div><p className="serif text-[1.5rem] leading-tight">{ph.t}</p><p className="text-[13px] opacity-85 mt-1">{ph.s}</p></div></div>
        </div>
        <div className="wave mt-3" aria-hidden>{bars.map((k, i) => <i key={i} style={{ ["--k" as any]: k }} />)}</div>

        {needsTap && <div className="text-center mt-4"><button onClick={begin} className="b b-primary">Tap to start the voice</button></div>}
        {!sttOk && <p role="status" className="text-center text-[14px] text-ink2 mt-3">I can't hear you in this browser, so use the buttons. Chrome works best.</p>}

        <div className="card-flat mt-6 p-4 lg:p-5" aria-live="polite">
          <p className="eyebrow flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v0M8 8v8M12 5v14M16 8v8M20 12v0" /></svg>Spoken transcript</p>
          <div className="mt-2 space-y-1">
            {lines.slice(0, -1).map((l, i) => <p key={i} className="text-[1.05rem] leading-snug text-ink2/60">{l}</p>)}
            <p className="serif text-[1.5rem] leading-[1.3]"><span className="bg-mint/60 rounded px-1 box-decoration-clone">{caption || "…"}</span></p>
          </div>
        </div>

        {ui.finish ? (
          <div className="mt-5 grid gap-2">
            <button onClick={() => say("keep going")} className="b b-primary w-full">Keep going with me</button>
            <div className="grid sm:grid-cols-2 gap-2"><button onClick={share} className="b b-soft border border-line">Message someone I trust</button><button onClick={consentCheckin} className="b b-soft border border-line">Check in with me tomorrow</button></div>
            <div className="grid sm:grid-cols-2 gap-2"><a href="/diary" className="b b-ghost">Talk it out in my Voice Diary</a><a href="/care" className="b b-ghost">Find support near me</a></div>
            <button onClick={onExit} className="b w-full text-ink2 underline">I'm done</button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button onClick={togglePause} className="b b-soft !px-2 text-[14px]">{paused ? "Resume Voice" : "Pause Voice"}</button>
              <button onClick={() => changeVoiceOn(!voiceOn)} aria-pressed={!voiceOn} className="b b-soft !px-2 text-[14px]">{voiceOn ? "Quiet Mode" : "Voice Off · On?"}</button>
              <button onClick={() => changeRate(rate < 1 ? 1 : 0.9)} aria-pressed={rate < 1} className={`b !px-2 text-[14px] ${rate < 1 ? "b-primary" : "b-soft"}`}>Slow Tempo</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => say("something else")} className="b b-ghost">Try another technique</button>
              <button onClick={okayNow} className="b b-ghost">I'm okay now</button>
            </div>
            <button onClick={helpNow} className="b b-terrasoft w-full mt-2">I need help now</button>
          </>
        )}
        {toast && <p role="status" className="text-sage text-sm mt-3">{toast}</p>}
        <button onClick={onExit} className="mt-4 text-[13px] text-ink2 underline min-h-10">Leave this session</button>
      </section>

      {/* ---------- context column ---------- */}
      <aside className="space-y-6">
        <article className="card p-6">
          <h2 className="text-[1.5rem] flex items-center gap-3"><span className="size-9 rounded-full bg-sky/70 grid place-items-center" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D5A73" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11ZM10 20h4" /></svg></span>Why this works right now</h2>
          <p className="mt-3 text-[1.02rem] leading-relaxed text-ink2">{why?.text ?? "I'll explain why each technique helps as we go, and how strong the evidence really is."}</p>
          {why?.source && <p className="mt-3 text-[13px]"><span className="tag">Source</span> <a className="underline text-slate" target="_blank" rel="noreferrer" href={why.source.url}>{why.source.name}</a></p>}
          <div className="card-flat mt-4 p-4 text-[14.5px] text-ink2">You don't have to feel calm to do this. Following the steps is enough, and it's okay if it's only a little easier.</div>
        </article>

        <article className="card p-6">
          <div className="flex items-baseline justify-between"><h2 className="text-[1.5rem]">Immediate room anchors</h2><span className="text-[12px] text-ink2">Tap to anchor</span></div>
          <div className="mt-3 space-y-2">
            {(anchors.length ? anchors : ["Feel both feet on the floor", "Let your shoulders drop", "Notice one thing you can see"]).map((a) => (
              <button key={a} role="checkbox" aria-checked={!!checked[a]} onClick={() => setChecked((c) => ({ ...c, [a]: !c[a] }))} className="check-row">
                <span className="box">{checked[a] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span>
                <span className="text-[15px]">{a}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="card p-6">
          <div className="flex items-center justify-between gap-2"><h2 className="text-[1.5rem]">Trusted sources</h2><span className="tag tag-stone">Bright Data · Gemini</span></div>
          <p className="mt-2 text-[14.5px] text-ink2">While you're here, I look up techniques on trusted health sites and turn them into steps. They aren't reviewed by a clinician.</p>
          <p className="mt-3 text-[14.5px]">
            {tech.status === "pending" ? <span className="text-sage font-medium">● Looking up techniques for you right now…</span>
              : tech.items.length ? <span className="text-sage font-medium">✓ {tech.items.length} techniques from {names.slice(0, 2).join(" and ")}</span>
              : <span className="text-ink2">{tech.status ? "Nothing extra found this time. Using the reviewed techniques." : "Starting…"}</span>}
          </p>
          <ul className="mt-2 space-y-1">{tech.items.slice(0, 5).map((i) => <li key={i.title + i.source_url} className="text-[14px]"><a className="underline text-slate" target="_blank" rel="noreferrer" href={i.source_url}>{i.title}</a> <span className="text-ink2">· {i.source_name}</span></li>)}</ul>
          <p className="mt-2 text-[12px] text-ink2">For intrusive thoughts I only use reviewed exercises.</p>
        </article>

        <article className="card p-6">
          <h2 className="text-[1.5rem]">Choose a technique</h2>
          <div className="mt-3 grid gap-2">
            {catalog.map((c) => (
              <button key={c.id} onClick={() => choose(c.id)} className={`text-left rounded-xl p-3.5 ${exId === c.id ? "bg-mint/50 ring-1 ring-sage/40" : "bg-cream hover:bg-stone"}`}>
                <span className="block font-semibold text-[15px]">{c.title}{exId === c.id ? " · now" : ""}</span><span className="block text-[13.5px] text-ink2">{c.blurb}</span>
              </button>
            ))}
            {!catalog.length && <p className="text-[14px] text-ink2">They'll appear in a moment.</p>}
          </div>
          <h3 className="eyebrow mt-5">Voice speed</h3>
          <div className="seg mt-2" role="group">{RATES.map(([l, v]) => <button key={l} aria-pressed={rate === v} onClick={() => changeRate(v)}>{l}</button>)}</div>
          {!sttOk && (
            <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { say(typed.trim()); setTyped(""); } }} className="flex gap-2 mt-4">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type to me" /><button className="b b-soft">Send</button>
            </form>
          )}
          <p className="mt-4 text-[13px] text-ink2"><a className="underline" href="/voice">Change my voice</a></p>
        </article>

        <article className="card p-5 flex items-center gap-4">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden><ellipse cx="32" cy="52" rx="22" ry="7" fill="#D9D4C7" /><ellipse cx="32" cy="42" rx="16" ry="6.5" fill="#B9B3A3" /><ellipse cx="32" cy="32" rx="11" ry="5.5" fill="#9C9686" /><ellipse cx="32" cy="23.5" rx="7" ry="4.5" fill="#7F7A6C" /></svg>
          <div><p className="eyebrow">Visual rest</p><p className="text-[14.5px] text-ink2">Let your eyes rest on one still point. Let your vision widen to the edges of the room.</p></div>
        </article>
      </aside>

      {/* ---------- crisis overlay ---------- */}
      {crisis && (
        <>
          <div className="sheet-back" />
          <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-[70] overflow-y-auto grid place-items-center p-4">
            <div className="card max-w-[520px] w-full p-7 space-y-4">
              <span className="tag tag-terra">{crisis === "medical" ? "Possible medical emergency" : "Help is here"}</span>
              <h1 className="text-[2rem] leading-tight">{crisis === "medical" ? "This could be a medical emergency." : "You're not alone. Help is here right now."}</h1>
              <p className="text-ink2">{crisis === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988, the US Suicide & Crisis Lifeline. It's free, and someone answers day and night."}</p>
              <a href={crisis === "medical" ? "tel:911" : "tel:988"} className="b b-terra w-full !min-h-[56px] text-[17px]">{crisis === "medical" ? "Call 911" : "Call 988"}</a>
              {crisis !== "medical" && <a href="sms:988" className="b b-soft w-full border border-line">Text 988</a>}
              <a href={crisis === "medical" ? "tel:988" : "tel:911"} className="b b-soft w-full border border-line">{crisis === "medical" ? "Call 988 (emotional crisis)" : "Call 911 (medical emergency)"}</a>
              <button onClick={share} className="b b-ghost w-full">Message someone I trust</button>
              <button onClick={safeNow} className="b w-full text-ink2 underline">I'm safe right now. Keep guiding me.</button>
              <p className="text-[12px] text-ink2">Somewhere is a demo and not a medical service or crisis line. It can't call anyone for you; these buttons open your phone.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
