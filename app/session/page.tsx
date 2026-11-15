"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Seg = { text: string; pause_ms: number; listen?: boolean; sig: string; fb?: string };
type Ui = { crisis?: "self_harm" | "medical"; finish?: boolean; followup?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean; rate?: boolean; source?: { name: string; url: string; title: string } };
type Out = { say: Seg[]; lead: number; exBase: number; state: string; flow: string; exerciseId?: string; exerciseTitle?: string; ui: Ui; research?: { key: string } };

const TRUST_MSG = "I'm having a hard time right now. Can you stay in touch with me?";
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const b64url = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

function Session() {
  const router = useRouter();
  const sessionId = useSearchParams().get("id");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<"speaking" | "listening" | "paused" | "idle">("idle");
  const [crisis, setCrisis] = useState<"self_harm" | "medical" | null>(null);
  const [ui, setUi] = useState<Ui>({});
  const [title, setTitle] = useState("");
  const [paused, setPaused] = useState(false);
  const [sttOk, setSttOk] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [toast, setToast] = useState("");
  const [typed, setTyped] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [src, setSrc] = useState<{ name: string; url: string; title: string } | null>(null);
  const [tech, setTech] = useState<{ status: string | null; items: { title: string; source_name: string; source_url: string }[] }>({ status: null, items: [] });
  const pollOn = useRef(false);

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

  /** Poll what Bright Data has found so far for her situation (runs in the background on the server). */
  const startPoll = () => {
    if (pollOn.current) return; pollOn.current = true; let n = 0;
    setTech((t) => ({ ...t, status: "pending" }));
    const iv = setInterval(async () => {
      n++;
      const j = await fetch(`/api/sos/techniques?session=${sessionId}`).then((r) => r.json()).catch(() => null);
      if (j) setTech(j);
      if (n >= 20 || (j && j.status && j.status !== "pending")) { clearInterval(iv); pollOn.current = false; }
    }, 4000);
  };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 5000); };

  /* ---------- audio ---------- */
  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const a = new Audio(); a.preload = "auto"; audio.current = a;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); actx.current = ctx;
      const src = ctx.createMediaElementSource(a), an = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an); an.connect(ctx.destination);
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

  const playSrc = (src: string, my: number): Promise<"ok" | "fail" | "int" | "blocked"> =>
    new Promise((res) => {
      const a = ensureAudio(); let done = false; let started = false; let endTimer: any;
      const end = (r: "ok" | "fail" | "int" | "blocked") => {
        if (done) return; done = true; clearInterval(iv); clearTimeout(startDog); clearTimeout(endTimer);
        a.onended = null; a.onerror = null; a.onplaying = null; a.onloadedmetadata = null; res(r);
      };
      const iv = setInterval(() => { if (epoch.current !== my) { try { a.pause(); } catch {} end("int"); } }, 50);
      // Watchdog: if audio never starts (autoplay blocked, no output device), say so instead of hanging silently.
      const startDog = setTimeout(() => { if (!started) { try { a.pause(); } catch {} end("blocked"); } }, 3500);
      a.onplaying = () => { started = true; clearTimeout(startDog); };
      // Backup: some environments never fire "ended"; force it shortly after the clip's duration.
      a.onloadedmetadata = () => { if (isFinite(a.duration)) endTimer = setTimeout(() => end("ok"), a.duration * 1000 + 1500); };
      a.onended = () => end("ok"); a.onerror = () => end("fail");
      a.src = src;
      actx.current?.resume().catch(() => {});
      a.play().catch((e) => end(e?.name === "NotAllowedError" ? "blocked" : "fail"));
    });

  const sleep = (ms: number, my: number) => new Promise<void>((res) => { const t0 = Date.now(); const iv = setInterval(() => { if (epoch.current !== my || Date.now() - t0 >= ms) { clearInterval(iv); res(); } }, 60); });

  const turnCall = async (body: any): Promise<Out | null> => {
    try {
      const r = await fetch("/api/sos/turn", { method: "POST", body: JSON.stringify({ sessionId, ...body }) });
      if (!r.ok) throw new Error();
      return await r.json();
    } catch { return null; }
  };

  /** Speak a list of segments in order. Interruptible at any point by bumping epoch. */
  const play = useCallback(async (out: Out): Promise<boolean> => {
    const my = ++epoch.current;
    for (let i = 0; i < out.say.length; i++) {
      if (epoch.current !== my) return false;
      const s = out.say[i];
      spokenIdx.current = i < out.lead ? out.exBase - 1 : out.exBase + (i - out.lead);
      setCaption(s.text); setMode("speaking"); speaking.current = true; speakingText.current = norm(s.text);
      let r = await playSrc(`/api/sos/tts?t=${b64url(s.text)}&s=${s.sig}&v=${voice.current}`, my);
      if (r === "blocked") { speaking.current = false; setNeedsTap(true); return false; }
      if (r === "fail" && s.fb) r = await playSrc(s.fb, my);
      if (r === "fail") await sleep(Math.min(6000, 700 + s.text.length * 55), my); // no audio at all: keep pace by reading time
      speaking.current = false; echoUntil.current = Date.now() + 1200;
      if (epoch.current !== my) return false;
      interrupted.current = false;
      setMode("listening");
      await sleep(s.pause_ms, my);
    }
    return epoch.current === my;
  }, []);

  const handleOut = useCallback(async (out: Out) => {
    if (out.exerciseTitle) setTitle(out.exerciseTitle);
    setUi(out.ui);
    if (out.ui.source) setSrc(out.ui.source); else if (out.exerciseId && !out.exerciseId.startsWith("src:")) setSrc(null);
    if (out.research) startPoll();
    if (out.ui.crisis) setCrisis(out.ui.crisis);
    if (out.ui.checkinConsent) fetch("/api/checkins", { method: "POST", body: JSON.stringify({ sessionId, hour: new Date().getHours() }) }).catch(() => {});
    const finished = await play(out);
    if (finished && out.state === "support" && out.lead < out.say.length) {
      const next = await turnCall({ event: "segments_done" });
      if (next) await handleOut(next);
    }
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopSpeaking = () => { epoch.current++; speaking.current = false; try { audio.current?.pause(); } catch {} };

  const handleUser = useCallback(async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    const wasInterrupted = interrupted.current || speaking.current;
    stopSpeaking(); setCaption("…"); setMode("listening");
    const out = await turnCall({ text, spoken_idx: spokenIdx.current, interrupted: wasInterrupted });
    busy.current = false;
    if (!out) { setCaption("I'm still here. Let's take one slow breath together."); return; }
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
    const out = await turnCall({ event: "start" });
    if (!out) { setCaption("I'm here. Let's take one slow breath together."); return; }
    firstOut.current = out;
    await handleOut(out);
  }, [handleOut]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionId) { router.replace("/"); return; }
    fetch("/api/voices").then((r) => r.json()).then((j) => { voice.current = j.selected.id; setVoiceName(j.selected.kind === "clone" ? j.selected.name : ""); }).catch(() => {}).finally(() => { begin(); startRec(); });
    return () => { epoch.current++; stopRec(); try { audio.current?.pause(); } catch {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- buttons ---------- */
  const togglePause = async () => {
    if (!paused) { stopSpeaking(); stopRec(); setPaused(true); setMode("paused"); setCaption("Paused. Tap resume whenever you're ready."); }
    else {
      setPaused(false); startRec();
      const out = await turnCall({ event: "resume", spoken_idx: spokenIdx.current, interrupted: true });
      if (out) await handleOut(out);
    }
  };
  const okayNow = async () => { stopSpeaking(); const out = await turnCall({ event: "okay_now" }); if (out) await handleOut(out); };
  const helpNow = async () => {
    stopSpeaking(); setCrisis("self_harm");
    const out = await turnCall({ event: "help_now" }); if (out) await handleOut(out);
  };
  const safeNow = async () => { setCrisis(null); const out = await turnCall({ event: "safe_now" }); if (out) await handleOut(out); };
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text: TRUST_MSG }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(TRUST_MSG); flash("Copied. Paste it to someone you trust."); } catch { flash(TRUST_MSG); }
  };
  const say = (t: string) => handleUser(t);

  if (!sessionId) return null;
  const done = ui.done;
  return (
    <main className="p-5 flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div ref={orb} className={`orb ${mode === "listening" ? "listening" : mode === "paused" || mode === "idle" ? "paused" : ""}`} aria-hidden />
        {title && <p className="text-center text-sm text-muted">{title}</p>}
        {src && <p className="text-center text-xs text-muted">From {src.name}: <a className="underline" target="_blank" rel="noreferrer" href={src.url}>{src.title}</a> · not reviewed by a clinician</p>}
        <p aria-live="polite" className="text-2xl text-center leading-snug min-h-28">{caption || "…"}</p>
        {tech.status && (
          <details className="bg-surface rounded-xl px-4 py-3 text-sm">
            <summary className="cursor-pointer min-h-8 flex items-center text-teal">
              {tech.status === "pending" ? "● Looking up calming approaches from trusted sources…" : tech.items.length ? `✓ Found ${tech.items.length} approaches from ${[...new Set(tech.items.map((i) => i.source_name))].slice(0, 2).join(" and ")}` : "No extra approaches found. Using the reviewed ones."}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {tech.items.map((i) => <li key={i.title + i.source_url}><a className="underline" target="_blank" rel="noreferrer" href={i.source_url}>{i.title}</a> <span className="text-muted">· {i.source_name}</span></li>)}
            </ul>
            <p className="text-xs text-muted mt-2">Found on public pages and turned into short steps. Not reviewed by a clinician. For intrusive thoughts I only use reviewed exercises.</p>
          </details>
        )}
        {voiceName && <p className="text-xs text-center text-muted">Guidance read in {voiceName}'s voice</p>}
        {toast && <p role="status" className="text-center text-teal text-sm">{toast}</p>}
        {needsTap && <button onClick={begin} className="mx-auto min-h-16 px-8 rounded-2xl bg-accent text-ground text-lg font-bold">Tap to start the voice</button>}
        {!sttOk && <p role="status" className="text-center text-amber text-sm">I can't hear you in this browser. Use the buttons below instead, or open this in Chrome.</p>}
      </div>

      {ui.rate && !done && (
        <div role="group" aria-label="How intense is it, from one to ten" className="grid grid-cols-5 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <button key={n} onClick={() => say(String(n))} className="min-h-12 rounded-xl bg-surface text-lg text-ink">{n}</button>)}
        </div>
      )}
      {ui.finish && !done && (
        <div className="grid grid-cols-1 gap-2 mb-3">
          <button onClick={() => say("keep going")} className="min-h-14 rounded-2xl bg-surface text-lg">Keep going</button>
          <button onClick={() => say("stop")} className="min-h-14 rounded-2xl bg-surface text-lg">Stop here</button>
          <button onClick={share} className="min-h-14 rounded-2xl bg-surface text-lg">Message someone I trust</button>
        </div>
      )}
      {ui.followup && !done && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => say("yes")} className="min-h-14 rounded-2xl bg-accent text-ground font-semibold">Yes, check in tomorrow</button>
          <button onClick={() => say("no")} className="min-h-14 rounded-2xl bg-surface">No thanks</button>
          {ui.suggestCare && <a href="/care" className="col-span-2 min-h-14 rounded-2xl bg-surface flex items-center justify-center text-teal">When you're ready: find support near you</a>}
        </div>
      )}
      {ui.trusted && <button onClick={share} className="mb-3 min-h-14 rounded-2xl bg-teal text-ground font-bold text-lg">Send my message to someone I trust</button>}
      {done && (
        <div className="grid gap-2 mb-3">
          {ui.suggestCare && <a href="/care" className="min-h-14 rounded-2xl bg-surface flex items-center justify-center text-teal">Find support near you</a>}
          <button onClick={() => router.push("/")} className="min-h-14 rounded-2xl bg-accent text-ground font-bold">Back home</button>
        </div>
      )}

      {!done && (
        <>
          <div className="flex justify-center gap-2 mb-3" role="group" aria-label="Quick replies">
            {[["Slower", "slower"], ["Something else", "something else"], ["That helped", "that helped"]].map(([l, v]) => (
              <button key={v} onClick={() => say(v)} className="px-4 min-h-12 rounded-full bg-surface text-sm text-ink">{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pb-2">
            <button onClick={togglePause} className="min-h-16 rounded-2xl bg-surface text-lg">{paused ? "Resume" : "Pause"}</button>
            <button onClick={okayNow} className="min-h-16 rounded-2xl bg-surface text-lg">I'm okay now</button>
            <button onClick={helpNow} className="col-span-2 min-h-16 rounded-2xl bg-coral text-ground text-lg font-bold">I need help now</button>
          </div>
        </>
      )}
      {!sttOk && (
        <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { say(typed.trim()); setTyped(""); } }} className="flex gap-2 mt-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type instead" className="flex-1 bg-surface rounded-xl px-3 min-h-12" />
          <button className="px-4 rounded-xl bg-surface min-h-12">Send</button>
        </form>
      )}
      <p className="text-xs text-muted text-center pt-3">Somewhere is a demo and not a medical service or crisis line.</p>

      {crisis && (
        <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-50 bg-ground/95 overflow-y-auto">
          <div className="max-w-[480px] mx-auto p-5 space-y-4">
            <h1 className="text-3xl font-semibold leading-tight">{crisis === "medical" ? "This could be a medical emergency." : "You're not alone. Help is available right now."}</h1>
            <p className="text-lg text-muted leading-snug">
              {crisis === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988, the US Suicide & Crisis Lifeline. It's free and open all day and night."}
            </p>
            <a href={crisis === "medical" ? "tel:911" : "tel:988"} className="btn flex items-center justify-center min-h-20 rounded-3xl bg-coral text-ground text-2xl font-bold">{crisis === "medical" ? "Call 911" : "Call 988"}</a>
            {crisis !== "medical" && <a href="sms:988" className="btn flex items-center justify-center min-h-16 rounded-2xl bg-surface text-xl">Text 988</a>}
            <a href={crisis === "medical" ? "tel:988" : "tel:911"} className="btn flex items-center justify-center min-h-16 rounded-2xl bg-surface text-xl">{crisis === "medical" ? "Call 988 (emotional crisis)" : "Call 911 (medical emergency)"}</a>
            <button onClick={share} className="w-full min-h-16 rounded-2xl bg-surface text-xl">Message someone I trust</button>
            <button onClick={safeNow} className="w-full min-h-14 rounded-2xl text-muted underline">I'm safe right now</button>
            <p className="text-xs text-muted">Somewhere is a demo and not a medical service or crisis line. It can't call anyone for you; these buttons open your phone.</p>
          </div>
        </div>
      )}
    </main>
  );
}
export default function Page() { return <Suspense><Session /></Suspense>; }
