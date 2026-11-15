"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import CrisisModal from "./CrisisModal";

type Line = { role: "user" | "agent"; text: string };
type Phase = { label: string; ms: number; scale: number };
const PATTERNS: Record<string, Phase[]> = {
  calm: [{ label: "Breathe in", ms: 4000, scale: 1.18 }, { label: "Breathe out slowly", ms: 6000, scale: 0.86 }],
  sigh: [{ label: "Breathe in through your nose", ms: 2200, scale: 1.1 }, { label: "A little more air", ms: 1300, scale: 1.2 }, { label: "Out slowly through your mouth", ms: 6000, scale: 0.86 }],
  box: [{ label: "Breathe in", ms: 4000, scale: 1.18 }, { label: "Hold", ms: 4000, scale: 1.18 }, { label: "Breathe out", ms: 4000, scale: 0.86 }, { label: "Hold", ms: 4000, scale: 0.86 }],
};
const SCENES: [string, string][] = [["rain", "Rain"], ["ocean", "Ocean"], ["forest", "Forest"], ["hum", "Warm hum"]];
const PAGES: Record<string, { href: string; label: string; sub: string }> = {
  diary: { href: "/diary", label: "Open my Voice Diary", sub: "Say everything on your mind. I'll listen." },
  care: { href: "/care", label: "Find care near me", sub: "Therapists and groups, with sources." },
  tracker: { href: "/tracker", label: "Open my tracker", sub: "See how you've been doing over time." },
};

export default function Companion(props: { sessionId: string; mode: string; onExit: () => void; onFallback: () => void }) {
  return <ConversationProvider><Inner {...props} /></ConversationProvider>;
}

function Inner({ sessionId, mode, onExit, onFallback }: { sessionId: string; mode: string; onExit: () => void; onFallback: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [crisis, setCrisis] = useState<null | "self_harm" | "medical">(null);
  const [pacer, setPacer] = useState<{ pattern: string; rounds: number } | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [anchors, setAnchors] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [why, setWhy] = useState("");
  const [suggest, setSuggest] = useState<string | null>(null);
  const [scene, setScene] = useState("");
  const [sceneMsg, setSceneMsg] = useState("");
  const [tech, setTech] = useState<{ status: string | null; items: { title: string; source_name: string; source_url: string }[] }>({ status: null, items: [] });
  const [logged, setLogged] = useState("");
  const [tab, setTab] = useState<"why" | "anchors" | "sources" | "sound">("why");
  const [err, setErr] = useState("");
  const [started, setStarted] = useState(false);
  const h = useRef<any>({});
  const sound = useRef<HTMLAudioElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const pollOn = useRef(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  const conv = useConversation({
    clientTools: {
      start_breathing_pacer: (p: any) => h.current.pacer(p),
      show_room_anchors: (p: any) => h.current.anchors(p),
      show_why_it_works: (p: any) => h.current.why(p),
      get_trusted_techniques: (p: any) => h.current.techniques(p),
      play_soundscape: (p: any) => h.current.soundscape(p),
      show_crisis_resources: (p: any) => h.current.crisis(p),
      log_to_tracker: (p: any) => h.current.log(p),
      suggest_page: (p: any) => h.current.suggest(p),
    },
    onMessage: (m: any) => h.current.onMessage(m),
    onError: () => setErr("The voice connection hit a problem."),
  } as any);

  /* ---------- the conversation ---------- */
  const startPoll = () => {
    if (pollOn.current) return; pollOn.current = true; let n = 0;
    setTech((t) => ({ ...t, status: "pending" }));
    const iv = setInterval(async () => {
      n++;
      const j = await fetch(`/api/sos/techniques?session=${sessionId}`).then((r) => r.json()).catch(() => null);
      if (j) setTech(j);
      if (n >= 20 || (j && j.status && j.status !== "pending")) { clearInterval(iv); pollOn.current = false; }
    }, 3000);
  };

  const connect = useCallback(async () => {
    setErr("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { setErr("I need your microphone to talk with you. Allow it in the address bar, then try again."); return; }
    const r = await fetch(`/api/companion/start?session=${sessionId}&mode=${mode}`).catch(() => null);
    if (!r?.ok) { onFallback(); return; }
    const j = await r.json();
    try { (conv as any).startSession({ signedUrl: j.signedUrl, connectionType: "websocket", dynamicVariables: j.vars }); setStarted(true); try { sessionStorage.setItem(`sw_live_${sessionId}`, "1"); } catch {} }
    catch { onFallback(); }
  }, [sessionId, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [resume, setResume] = useState(false);
  useEffect(() => {
    // A page reload (or dev hot-reload) mid-conversation must not silently start talking again.
    let again = false; try { again = !!sessionStorage.getItem(`sw_live_${sessionId}`); } catch {}
    if (again) setResume(true); else connect();
    return () => { try { sound.current?.pause(); (conv as any).endSession(); } catch {} }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- safety: the conversation can never override this ---------- */
  const checkSafety = async (text: string) => {
    const j = await fetch("/api/safety/check", { method: "POST", body: JSON.stringify({ text }) }).then((r) => r.json()).catch(() => null);
    if (j?.level === "crisis") setCrisis("self_harm"); else if (j?.level === "medical") setCrisis("medical");
  };

  /* ---------- tools the companion can call ---------- */
  h.current = {
    onMessage: (m: any) => {
      const role: "user" | "agent" = (m.source ?? m.role) === "user" ? "user" : "agent";
      const text = String(m.message ?? m.text ?? "").trim(); if (!text) return;
      setLines((l) => [...l.slice(-30), { role, text }]);
      if (role === "user") checkSafety(text);
      setTimeout(() => scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }), 50);
    },
    pacer: (p: any) => { const pattern = PATTERNS[p?.pattern] ? p.pattern : "sigh"; setPacer({ pattern, rounds: Math.min(12, Math.max(2, Number(p?.rounds) || 5)) }); return "Pacer is on screen. Count with it, and don't talk over every breath."; },
    anchors: (p: any) => { const items = String(p?.items ?? "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 4); setAnchors(items); setChecked({}); return "Anchors are on screen."; },
    why: (p: any) => { setWhy(String(p?.text ?? "").slice(0, 400)); return "Shown."; },
    techniques: async (p: any) => { startPoll(); const j = await fetch("/api/companion/techniques", { method: "POST", body: JSON.stringify({ sessionId, situation: String(p?.situation ?? "anxiety") }) }).then((r) => r.json()).catch(() => null); return j?.text ?? "Nothing came back. Use slow breathing and grounding."; },
    soundscape: (p: any) => { playScene(String(p?.scene ?? "rain")); return "Playing it softly."; },
    crisis: (p: any) => { setCrisis(p?.kind === "medical" ? "medical" : "self_harm"); return "Resources are on screen."; },
    log: async (p: any) => {
      const kind = p?.kind === "panic_episode" ? "panic_episode" : "ocd_urge";
      const data = kind === "panic_episode" ? { intensity: 5, minutes: Number(p?.minutes) || 0, helped: [] } : { trigger: "not stated", urge: "not stated", response: ["did", "delayed", "resisted"].includes(p?.response) ? p.response : "delayed", delay_min: Number(p?.minutes) || undefined, note: p?.note ? String(p.note).slice(0, 200) : undefined };
      const r = await fetch("/api/tracker", { method: "POST", body: JSON.stringify({ kind, data }) });
      if (r.ok) { setLogged(kind === "panic_episode" ? "Logged a panic episode" : `Logged: ${data.response}`); return "Logged in their tracker."; }
      return "I couldn't log that.";
    },
    suggest: (p: any) => { setSuggest(PAGES[p?.page] ? p.page : null); return "Offered."; },
  };

  /* ---------- breathing pacer ---------- */
  useEffect(() => {
    if (!pacer) { setPhase(null); return; }
    const seq = PATTERNS[pacer.pattern]; let i = 0, alive = true, timer: any;
    const step = () => {
      if (!alive) return;
      const total = seq.length * pacer.rounds;
      if (i >= total) { setPacer(null); return; }
      const ph = seq[i % seq.length]; setPhase(ph); i++; timer = setTimeout(step, ph.ms);
    };
    step();
    return () => { alive = false; clearTimeout(timer); };
  }, [pacer]);

  /* ---------- soundscapes (ElevenLabs Sound Effects, cached in Neon) ---------- */
  const playScene = (s: string) => {
    if (s === "off" || !s) { sound.current?.pause(); setScene(""); setSceneMsg(""); return; }
    setScene(s); setSceneMsg("Loading…");
    const a = sound.current ?? (sound.current = new Audio()); a.loop = true; a.volume = 0.22; a.src = `/api/soundscape?scene=${s}`;
    a.oncanplay = () => setSceneMsg(""); a.onerror = () => { setSceneMsg("Soundscapes need the Sound Effects permission on your ElevenLabs key."); setScene(""); };
    a.play().catch(() => setSceneMsg("Tap a sound again to start it."));
  };

  const toggleMute = () => { const m = !muted; setMuted(m); try { (conv as any).setMuted(m); } catch {} };
  const end = () => { try { sound.current?.pause(); (conv as any).endSession(); } catch {} onExit(); };
  const say = (t: string) => { try { (conv as any).sendUserMessage(t); } catch {} };

  const status = conv.status === "connected" ? (conv.isSpeaking ? "Speaking" : muted ? "Muted" : "Listening") : started ? "Connecting…" : "Starting…";
  const lastAgent = [...lines].reverse().find((l) => l.role === "agent")?.text;
  const lastUser = [...lines].reverse().find((l) => l.role === "user")?.text;
  const names = [...new Set(tech.items.map((i) => i.source_name))];

  return (
    <div ref={root} className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start fade-in">
      <section className="card p-5 lg:p-7" aria-label="Conversation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[14.5px] font-medium"><i className={`size-2.5 rounded-full ${conv.status === "connected" ? "bg-sage" : "bg-[#CFC9BB]"}`} aria-hidden />Juno · {status}</p>
          <span className="tag tag-sage">Live conversation</span>
        </div>

        <div className="bc manual mt-5" style={{ ["--s" as any]: phase ? phase.scale : conv.isSpeaking ? 1.04 : 1, ["--d" as any]: phase ? `${phase.ms / 1000}s` : "1.2s" }} aria-hidden>
          <i className="r r1" /><i className="r r2" /><i className="r r3" />
          <div className="core"><div className="px-2"><p className="serif text-[1.25rem] leading-tight">{phase ? phase.label : conv.isSpeaking ? "Juno" : conv.status === "connected" ? "I'm here" : "…"}</p></div></div>
        </div>

        <div className="mt-5 text-center min-h-[6rem]" aria-live="polite">
          {lastUser && <p className="text-[14px] text-ink2/70 mb-1 line-clamp-2">You: {lastUser}</p>}
          <p className="serif text-[1.5rem] leading-[1.3]">{lastAgent ?? (resume && !started ? "The page reloaded, so I paused." : err ? "" : "Connecting you…")}</p>
          {resume && !started && <button onClick={() => { setResume(false); connect(); }} className="b b-primary mt-3">Pick up again</button>}
        </div>
        {err && <p role="alert" className="text-terra text-center text-[14.5px]">{err} <button onClick={connect} className="underline">Try again</button></p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={toggleMute} aria-pressed={muted} className={`b !px-2 text-[14px] ${muted ? "b-primary" : "b-soft"}`}>{muted ? "Unmute me" : "Mute my mic"}</button>
          <button onClick={() => say("Please slow down a little.")} className="b b-soft !px-2 text-[14px]">Slow down</button>
          <button onClick={() => say("Can we try something different?")} className="b b-soft !px-2 text-[14px]">Something else</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => setCrisis("self_harm")} className="b b-terrasoft">I need help now</button>
          <button onClick={end} className="b b-ghost">End conversation</button>
        </div>

        {lines.length > 0 && (
          <details className="mt-4 card-flat p-4"><summary className="cursor-pointer text-[14px] font-semibold min-h-10 flex items-center">Conversation so far</summary>
            <div ref={scroller} className="mt-2 max-h-60 overflow-y-auto space-y-2">{lines.map((l, i) => <p key={i} className={`text-[14.5px] ${l.role === "user" ? "text-ink2" : "text-ink"}`}><b>{l.role === "user" ? "You" : "Juno"}:</b> {l.text}</p>)}</div>
            <p className="text-[12px] text-ink2 mt-2">Shown on this screen only. Not saved.</p></details>
        )}
        {logged && <p role="status" className="mt-3 text-sage text-[14px]">✓ {logged}. <a className="underline" href="/tracker">See my tracker</a></p>}
      </section>

      <aside className="space-y-4">
        {suggest && PAGES[suggest] && (
          <a href={PAGES[suggest].href} className="card p-4 block"><p className="text-[13px] text-ink2">Juno suggests</p><p className="font-medium">{PAGES[suggest].label}</p><p className="text-[13.5px] text-ink2">{PAGES[suggest].sub}</p></a>
        )}
        <article className="card p-5">
          <div className="seg" role="tablist" aria-label="Details">{([["why", "Why it works"], ["anchors", "Anchors"], ["sources", "Sources"], ["sound", "Sound"]] as const).map(([k, l]) => <button key={k} role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="mt-4 min-h-[9rem]">
            {tab === "why" && <p className="text-[15px] text-ink2 leading-relaxed">{why || "As we go, I'll tell you why a technique helps, and how strong the evidence really is."}</p>}
            {tab === "anchors" && <div className="space-y-2">{(anchors.length ? anchors : ["Feel both feet on the floor", "Let your shoulders drop", "Notice one thing you can see"]).map((a) => (
              <button key={a} role="checkbox" aria-checked={!!checked[a]} onClick={() => setChecked((c) => ({ ...c, [a]: !c[a] }))} className="check-row"><span className="box">{checked[a] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span className="text-[14.5px]">{a}</span></button>))}</div>}
            {tab === "sources" && <div className="text-[14.5px] space-y-2"><p className="text-ink2">When your situation is specific, Juno looks up techniques on trusted health sites. They aren't reviewed by a clinician.</p>
              <p>{tech.status === "pending" ? <span className="text-sage font-medium">● Looking them up right now…</span> : tech.items.length ? <span className="text-sage font-medium">{tech.items.length} techniques from {names.slice(0, 2).join(" and ")}</span> : <span className="text-ink2">Nothing looked up yet.</span>}</p>
              <ul className="space-y-1">{tech.items.slice(0, 4).map((i) => <li key={i.title + i.source_url}><a className="underline text-slate" target="_blank" rel="noreferrer" href={i.source_url}>{i.title}</a> <span className="text-ink2">· {i.source_name}</span></li>)}</ul></div>}
            {tab === "sound" && <div className="space-y-3"><p className="text-[14.5px] text-ink2">Calming sound made with ElevenLabs, playing softly under our conversation.</p>
              <div className="flex flex-wrap gap-2">{SCENES.map(([k, l]) => <button key={k} className="chip" aria-pressed={scene === k} onClick={() => playScene(scene === k ? "off" : k)}>{l}</button>)}</div>
              {sceneMsg && <p className="text-[13px] text-ink2">{sceneMsg}</p>}</div>}
          </div>
        </article>
      </aside>

      {crisis && <CrisisModal kind={crisis} onClose={() => setCrisis(null)} closeLabel="I'm safe right now. Keep talking with me." />}
    </div>
  );
}
