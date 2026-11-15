"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";
import Companion from "@/components/Companion";
import CrisisModal from "@/components/CrisisModal";

const OPTS: Record<string, { flow: string; title: string; sub: string }> = {
  panic: { flow: "panic", title: "Panic or a racing body", sub: "Pounding heart, fast breathing" },
  intrusive: { flow: "intrusive", title: "Looping thoughts or urges", sub: "Intrusive thoughts, checking, reassurance" },
  overwhelm: { flow: "overwhelm", title: "Overwhelmed", sub: "Too much at once" },
  talk: { flow: "talk", title: "Just talk", sub: "No technique, just company" },
};
const WHERE = ["at home", "at work or school", "out in public", "in bed"] as const;

function Now() {
  const router = useRouter();
  const sp = useSearchParams();
  const sos = sp.get("sos"), modeParam = sp.get("mode");
  const [session, setSession] = useState<{ id: string; flow: string } | null>(null);
  const [scripted, setScripted] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [own, setOwn] = useState(false);
  const [said, setSaid] = useState("");
  const [listening, setListening] = useState(false);
  const [crisis, setCrisis] = useState<null | "self_harm" | "medical">(null);
  const recRef = useRef<any>(null);
  function dictate() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setErr("Dictation needs Chrome. You can type instead.");
    if (listening) { recRef.current?.stop(); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e: any) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " "; if (t) setSaid((x) => (x + " " + t).trim()); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    try { r.start(); recRef.current = r; setListening(true); } catch {}
  }
  async function goOwn() {
    if (said.trim().length < 3) return; setBusy("own"); setErr("");
    const j = await fetch("/api/now/understand", { method: "POST", body: JSON.stringify({ text: said }) }).then((r) => r.json()).catch(() => null);
    setBusy("");
    if (j?.crisis) return setCrisis(j.crisis);
    if (!j?.flow) return setErr("I couldn't read that just now. Try again, or pick one of the options.");
    setOwn(false); start(j.flow, { said: said.trim(), empathy: j.empathy });
  }
  const [conds, setConds] = useState<string[]>([]);
  const auto = useRef(false);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((m) => setConds(m.profile?.conditions ?? [])).catch(() => {}); fetch("/api/research/warm").catch(() => {}); }, []);

  async function start(flow: string, extra: { said?: string; empathy?: string } = {}) {
    setBusy(flow); setErr(""); setScripted(false);
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow, where: where ?? undefined, ...extra }) });
      if (!res.ok) throw new Error();
      const s = await res.json(); setSession(null); setTimeout(() => setSession({ id: s.id, flow }), 0);
    } catch { setErr("I couldn't start. Please try again."); }
    setBusy("");
  }
  useEffect(() => {
    if (auto.current) return;
    if (sos) { auto.current = true; start(conds.includes("ocd") && false ? "intrusive" : "panic"); router.replace("/now"); }
    else if (modeParam && OPTS[modeParam]) { auto.current = true; start(modeParam); router.replace("/now"); }
  }, [sos, modeParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) document.documentElement.dataset.immersive = "1"; else delete document.documentElement.dataset.immersive; return () => { delete document.documentElement.dataset.immersive; }; }, [session]);
  const order = conds.includes("ocd") ? ["intrusive", "panic", "overwhelm", "talk"] : ["panic", "intrusive", "overwhelm", "talk"];

  return (
    <div className={session ? "space-y-6" : "max-w-[560px] mx-auto space-y-6"}>
      {!session && (
        <section className="max-w-[560px]"><h1>What's going on right now?</h1><p className="mt-1.5 text-ink2">Pick the closest one. You don't have to explain anything. <Link href="/voice" className="underline">Change Juno's voice</Link></p></section>
      )}
      {!session && own && (
        <div className="max-w-[560px] space-y-4 step-in">
          <h1>Tell me what's going on</h1>
          <p className="text-ink2 -mt-2">Say it or write it, as messy as you like. I'll listen first, then help in the way that fits.</p>
          <textarea value={said} onChange={(e) => setSaid(e.target.value)} rows={6} autoFocus aria-label="What's going on" placeholder="For example: my heart is racing and I can't stop thinking something is wrong…" />
          {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => { setOwn(false); setErr(""); }} className="b b-ghost">Back</button>
            <div className="flex gap-2"><button onClick={dictate} aria-pressed={listening} className={`b ${listening ? "b-terra" : "b-soft border border-line"}`}>{listening ? "Listening… tap to stop" : "Use my voice"}</button>
              <button onClick={goOwn} disabled={said.trim().length < 3 || busy === "own"} className="b b-primary">{busy === "own" ? "Reading…" : "Start"}</button></div>
          </div>
          <p className="text-[12.5px] text-ink2">What you write is used to start your conversation with Juno. If you say something that sounds like you're in danger, I'll show you where to get help right away.</p>
        </div>
      )}
      {crisis && <CrisisModal kind={crisis} onClose={() => setCrisis(null)} closeLabel="I'm safe right now" />}
      {!session && !own && (
        <div className="max-w-[560px] space-y-3">
          <section className="space-y-2.5 step-in" aria-label="What are you feeling">
            {order.map((k) => { const o = OPTS[k]; return (
              <button key={k} disabled={!!busy} onClick={() => start(o.flow)} className="w-full text-left rounded-xl border border-line bg-linen px-4 py-3.5 hover:border-sage/50 transition">
                <span className="block font-medium">{busy === o.flow ? "Starting…" : o.title}</span><span className="block text-[13.5px] text-ink2">{o.sub}</span>
              </button>); })}
            <button onClick={() => setOwn(true)} className="w-full text-left rounded-xl border border-dashed border-sage/60 bg-linen px-4 py-3.5 hover:border-sage transition"><span className="block font-medium">Tell me in my own words</span><span className="block text-[13.5px] text-ink2">Say or write what you're going through. I'll pick the right help.</span></button>
          </section>
          <details className="text-[14px]"><summary className="cursor-pointer text-ink2 underline w-fit">Tell Juno where you are (optional)</summary>
            <div className="flex flex-wrap gap-2 mt-2">{WHERE.map((w) => <button key={w} className="chip" aria-pressed={where === w} onClick={() => setWhere(where === w ? null : w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}</div></details>
        </div>
      )}
      {err && <p role="alert" className="text-terra">{err}</p>}
      {session && (
        <div className="immersive"><div className="max-w-[560px] mx-auto space-y-4">
          {scripted ? <Guide key={session.id} sessionId={session.id} onExit={() => setSession(null)} /> : <Companion key={session.id} sessionId={session.id} mode={session.flow} onExit={() => setSession(null)} onFallback={() => setScripted(true)} />}
          {!scripted && <p className="text-[13px] text-ink2 text-center">Prefer simple spoken steps without a live conversation? <button className="underline" onClick={() => setScripted(true)}>Use guided steps</button></p>}
        </div></div>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Now /></Suspense>; }
