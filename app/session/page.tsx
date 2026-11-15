"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Seg = { text: string; pause_ms: number; listen?: boolean; sig: string; fb?: string };
type Ui = { crisis?: "self_harm" | "medical"; finish?: boolean; followup?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean; source?: { name: string; url: string; title: string } };
type CatalogItem = { id: string; title: string; blurb: string; source?: string };
type Out = {
  say: Seg[]; lead: number; exBase: number; state: string; flow: string; exerciseId?: string; exerciseTitle?: string; ui: Ui; research?: { key: string };
  catalog: CatalogItem[]; transitions: Seg[]; progress: { block: number; max: number };
};

const TRUST_MSG = "I'm having a hard time right now. Can you stay in touch with me?";
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const b64url = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const RATES = [["Slower", 0.9], ["Normal", 1], ["Faster", 1.15]] as const;

function Session() {
  const router = useRouter();
  const sessionId = useSearchParams().get("id");

  const [caption, setCaption] = useState("");
  const [prevCaption, setPrevCaption] = useState("");
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
  const [src, setSrc] = useState<{ name: string; url: string; title: string } | null>(null);
  const [tech, setTech] = useState<{ status: string | null; items: { title: string; source_name: string; source_url: string }[] }>({ status: null, items: [] });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [progress, setProgress] = useState({ block: 0, max: 8 });
  const [menu, setMenu] = useState(false);
  const [rate, setRate] = useState(1);
  const [voiceOn, setVoiceOn] = useState(true);

  const audio = useRef<HTMLAudioElement | null>(null);
  const orb = useRef<HTMLDivElement | null>(null);
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
  const recent = useRef<string[]>([]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 5000); };

  useEffect(() => {
    try { const r = Number(localStorage.getItem("sw_rate")); if (r) { setRate(r); rateRef.current = r; } const v = localStorage.getItem("sw_voice"); if (v === "off") { setVoiceOn(false); voiceOnRef.current = false; } } catch {}
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
        orb.current?.style.setProperty("--lvl", String(Math.min(1, Math.sqrt(sum / buf.length) * 4)));
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
  const warm = (s?: Seg) => { if (s) fetch(urlOf(s)).then((r) => r.arrayBuffer()).catch(() => {}); }; // load the next lines ahead of time so there are no gaps

  const showCaption = (t: string) => { setCaption((c) => { if (c && c !== "…") setPrevCaption(c); return t; }); };

  /** Speak one segment. Returns "blocked" if the browser won't play audio. */
  const speak = async (s: Seg, my: number) => {
    showCaption(s.text); setMode("speaking"); speaking.current = true; speakingText.current = norm(s.text);
    let r = await playSrc(urlOf(s), my);
    if (r === "blocked") { speaking.current = false; return "blocked" as const; }
    if (r === "fail" && s.fb) r = await playSrc(s.fb, my);
    if (r === "fail") await sleep(Math.min(5000, 600 + s.text.length * 45), my); // no audio at all: keep pace by reading time
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
    if (out.exerciseId) setExId(out.exerciseId);
    if (out.catalog) setCatalog(out.catalog);
    if (out.transitions?.length) transRef.current = out.transitions;
    if (out.progress) setProgress(out.progress);
    setUi(out.ui);
    if (out.ui.source) setSrc(out.ui.source); else if (out.exerciseId && !out.exerciseId.startsWith("src:")) setSrc(null);
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
        else { recent.current = [...recent.current.slice(-2), tr]; handleUser(tr); }
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
    const out = await turnCall({ event: "start" });
    if (!out) { showCaption("I'm here. Breathe in slowly, and let it out."); return; }
    firstOut.current = out;
    await handleOut(out);
  }, [handleOut]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionId) { router.replace("/"); return; }
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
  const choose = async (id: string) => { setMenu(false); stopSpeaking(); setPaused(false); startRec(); const out = await turnCall({ event: "choose", exId: id }); if (out) await handleOut(out); };
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text: TRUST_MSG }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(TRUST_MSG); flash("Copied. Paste it to someone you trust."); } catch { flash(TRUST_MSG); }
  };
  const say = (t: string) => handleUser(t);
  const consentCheckin = async () => {
    await fetch("/api/checkins", { method: "POST", body: JSON.stringify({ sessionId, hour: new Date().getHours() }) }).catch(() => {});
    flash("Okay. I'll check in tomorrow, and remember what helped today.");
  };

  if (!sessionId) return null;
  const pace = exId === "exhale-breath" && mode !== "paused";
  const orbClass = mode === "listening" ? "listening" : mode === "paused" || mode === "idle" ? "paused" : "";
  const status = paused ? "Paused" : mode === "speaking" ? "Speaking" : mode === "listening" ? (sttOk ? "Listening" : "Waiting") : "Starting";
  const names = [...new Set(tech.items.map((i) => i.source_name))];

  return (
    <main className="flex flex-col min-h-dvh fade-in">
      {/* top bar */}
      <header className="flex items-center justify-between px-4 pt-4">
        <button onClick={() => router.push("/")} className="px-3 text-muted rounded-full min-h-11">← Leave</button>
        <div className="flex items-center gap-1.5" aria-label={`Step ${Math.min(progress.block + 1, progress.max)} of ${progress.max}`}>
          {Array.from({ length: progress.max }).map((_, i) => <i key={i} className={`block h-1.5 rounded-full transition-all ${i <= progress.block ? "w-5 bg-teal" : "w-2 bg-white/15"}`} />)}
        </div>
        <button onClick={() => setMenu(true)} className="px-4 bg-surface rounded-full min-h-11 text-[15px]">Options</button>
      </header>

      {/* stage */}
      <section className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-3 text-center">
        <div className={`orb-wrap ${pace ? "pace" : ""}`} aria-hidden>
          <i className="ring r3" /><i className="ring r2" /><i className="ring" />
          <div ref={orb} className={`orb ${orbClass}`} />
        </div>
        <p className="text-sm tracking-wide text-muted uppercase" aria-live="off">{title || "Starting"} · <span className={mode === "listening" ? "text-teal" : ""}>{status}</span></p>
        <div className="min-h-[9.5rem] flex flex-col justify-start gap-2" aria-live="polite">
          {prevCaption && <p className="text-base text-muted/60 leading-snug line-clamp-2">{prevCaption}</p>}
          <p className="text-[1.65rem] leading-[1.3] font-medium tracking-tight">{caption || "…"}</p>
        </div>
        {voiceName && <p className="text-xs text-muted">Guidance read in {voiceName}'s voice</p>}
        {src && <p className="text-xs text-muted">From {src.name}: <a className="underline" target="_blank" rel="noreferrer" href={src.url}>{src.title}</a> · not reviewed by a clinician</p>}
        {toast && <p role="status" className="text-teal text-sm">{toast}</p>}
        {needsTap && <button onClick={begin} className="btn-primary min-h-16 px-8 rounded-2xl text-lg font-semibold">Tap to start the voice</button>}
        {!sttOk && <p role="status" className="text-amber text-sm max-w-sm">I can't hear you in this browser, so use the buttons below. Chrome works best.</p>}

        {tech.status && (
          <button onClick={() => setMenu(true)} className="bg-surface rounded-full px-4 py-2 text-sm text-left max-w-full">
            {tech.status === "pending" ? <span className="text-teal">● Looking up trusted sources for you…</span>
              : tech.items.length ? <span className="text-teal">✓ {tech.items.length} techniques from {names.slice(0, 2).join(" and ")}</span>
              : <span className="text-muted">Using the reviewed techniques</span>}
          </button>
        )}
      </section>

      {/* controls */}
      <section className="px-4 pb-4 space-y-3">
        {ui.finish ? (
          <div className="grid gap-2">
            <button onClick={() => say("keep going")} className="btn-primary min-h-14 rounded-2xl text-lg font-semibold">Keep going with me</button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={share} className="bg-surface rounded-2xl min-h-14">Message someone</button>
              <button onClick={consentCheckin} className="bg-surface rounded-2xl min-h-14">Check in tomorrow</button>
            </div>
            {ui.suggestCare && <a href="/care" className="bg-surface rounded-2xl min-h-14 flex items-center justify-center text-teal">Find support near you</a>}
            <button onClick={() => router.push("/")} className="min-h-12 text-muted underline">I'm done</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={togglePause} className="bg-surface rounded-2xl min-h-[60px] text-[15px]">{paused ? "▶ Resume" : "❚❚ Pause"}</button>
              <button onClick={() => say("slower")} className="bg-surface rounded-2xl min-h-[60px] text-[15px]">Slower</button>
              <button onClick={() => say("something else")} className="bg-surface rounded-2xl min-h-[60px] text-[15px]">Try another</button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <button onClick={okayNow} className="col-span-2 bg-surface rounded-2xl min-h-14 text-[15px]">I'm okay now</button>
              <button onClick={helpNow} className="btn-help col-span-3 rounded-2xl min-h-14 text-[16px] font-semibold">I need help now</button>
            </div>
          </>
        )}
        <p className="text-[11px] text-muted text-center">Somewhere is a demo and not a medical service or crisis line.</p>
      </section>

      {/* options sheet */}
      {menu && (
        <>
          <div className="sheet-back" onClick={() => setMenu(false)} />
          <div className="sheet p-5 space-y-6" role="dialog" aria-label="Options">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Options</h2><button onClick={() => setMenu(false)} className="px-3 text-muted min-h-11">Close</button></div>

            <section className="space-y-2"><h3 className="text-sm uppercase tracking-wide text-muted">Voice speed</h3>
              <div className="seg" role="group">{RATES.map(([l, v]) => <button key={l} aria-pressed={rate === v} onClick={() => changeRate(v)}>{l}</button>)}</div></section>

            <section className="space-y-2"><h3 className="text-sm uppercase tracking-wide text-muted">Sound</h3>
              <div className="seg" role="group"><button aria-pressed={voiceOn} onClick={() => changeVoiceOn(true)}>Voice on</button><button aria-pressed={!voiceOn} onClick={() => changeVoiceOn(false)}>Captions only</button></div></section>

            <section className="space-y-2"><h3 className="text-sm uppercase tracking-wide text-muted">Choose a technique</h3>
              <div className="grid gap-2">
                {catalog.map((c) => (
                  <button key={c.id} onClick={() => choose(c.id)} className={`text-left rounded-2xl p-3.5 ${exId === c.id ? "bg-accent/20 ring-1 ring-accent" : "bg-white/[0.06]"}`}>
                    <span className="block font-medium">{c.title}{exId === c.id ? " · now" : ""}</span><span className="block text-sm text-muted">{c.blurb}</span>
                  </button>
                ))}
                {!catalog.length && <p className="text-muted text-sm">They'll appear in a moment.</p>}
              </div></section>

            <section className="space-y-2"><h3 className="text-sm uppercase tracking-wide text-muted">Trusted sources</h3>
              <p className="text-sm text-muted">While you're here, I look up techniques on trusted health sites (like the NHS, Mayo Clinic and NIMH) and turn them into steps. They aren't reviewed by a clinician.</p>
              {tech.status === "pending" && <p className="text-teal text-sm">● Looking them up right now…</p>}
              {tech.status === "none" || tech.status === "failed" || tech.status === "unavailable" ? <p className="text-muted text-sm">Nothing extra found this time. I'm using the reviewed techniques.</p> : null}
              <ul className="space-y-1.5">{tech.items.map((i) => <li key={i.title + i.source_url} className="text-sm"><a className="underline text-teal" target="_blank" rel="noreferrer" href={i.source_url}>{i.title}</a> <span className="text-muted">· {i.source_name}</span></li>)}</ul>
              <p className="text-xs text-muted">For intrusive thoughts I only use reviewed exercises.</p></section>

            {!sttOk && (
              <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { say(typed.trim()); setTyped(""); setMenu(false); } }} className="flex gap-2">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type to me" className="flex-1 bg-white/[0.06] rounded-xl px-4 min-h-12" /><button className="px-4 rounded-xl bg-white/[0.1] min-h-12">Send</button>
              </form>
            )}

            <section className="grid grid-cols-2 gap-2 pb-2">
              <a href="/breathe" className="bg-white/[0.06] rounded-2xl p-3.5 text-center">Breathe, no voice</a>
              <a href="/voice" className="bg-white/[0.06] rounded-2xl p-3.5 text-center">Change voice</a>
              <a href="/care" className="bg-white/[0.06] rounded-2xl p-3.5 text-center">Find support</a>
              <button onClick={() => { setMenu(false); helpNow(); }} className="btn-help rounded-2xl p-3.5">Get help now</button>
            </section>
          </div>
        </>
      )}

      {crisis && (
        <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-50 bg-[#0c1020]/97 overflow-y-auto">
          <div className="max-w-[520px] mx-auto p-6 space-y-4">
            <h1 className="text-3xl font-semibold leading-tight pt-4">{crisis === "medical" ? "This could be a medical emergency." : "You're not alone. Help is here right now."}</h1>
            <p className="text-lg text-muted leading-snug">
              {crisis === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988, the US Suicide & Crisis Lifeline. It's free, and someone answers day and night."}
            </p>
            <a href={crisis === "medical" ? "tel:911" : "tel:988"} className="btn flex items-center justify-center min-h-20 rounded-3xl bg-coral text-[#0c1020] text-2xl font-bold">{crisis === "medical" ? "Call 911" : "Call 988"}</a>
            {crisis !== "medical" && <a href="sms:988" className="btn flex items-center justify-center min-h-16 rounded-2xl bg-surface text-xl">Text 988</a>}
            <a href={crisis === "medical" ? "tel:988" : "tel:911"} className="btn flex items-center justify-center min-h-16 rounded-2xl bg-surface text-xl">{crisis === "medical" ? "Call 988 (emotional crisis)" : "Call 911 (medical emergency)"}</a>
            <button onClick={share} className="w-full min-h-16 rounded-2xl bg-surface text-xl">Message someone I trust</button>
            <button onClick={safeNow} className="w-full min-h-14 rounded-2xl text-muted underline">I'm safe right now. Keep guiding me.</button>
            <p className="text-xs text-muted">Somewhere is a demo and not a medical service or crisis line. It can't call anyone for you; these buttons open your phone.</p>
          </div>
        </div>
      )}
    </main>
  );
}
export default function Page() { return <Suspense><Session /></Suspense>; }
