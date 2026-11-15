"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";
import Companion from "@/components/Companion";

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
  const [conds, setConds] = useState<string[]>([]);
  const auto = useRef(false);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((m) => setConds(m.profile?.conditions ?? [])).catch(() => {}); fetch("/api/research/warm").catch(() => {}); }, []);

  async function start(flow: string) {
    setBusy(flow); setErr(""); setScripted(false);
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow, where: where ?? undefined }) });
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

  const order = conds.includes("ocd") ? ["intrusive", "panic", "overwhelm", "talk"] : ["panic", "intrusive", "overwhelm", "talk"];

  return (
    <div className="space-y-6 fade-in">
      {!session && (
        <section className="max-w-[560px]"><h1>What's going on right now?</h1><p className="mt-1.5 text-ink2">Pick the closest one and Juno will start talking with you. You don't have to explain anything. <Link href="/voice" className="underline">Change Juno's voice</Link></p></section>
      )}
      <section className="flex flex-wrap items-center gap-2" aria-label="Where are you, optional">
        <span className="text-[13.5px] text-ink2 mr-1">Where are you? (optional)</span>
        {WHERE.map((w) => <button key={w} className="chip" aria-pressed={where === w} onClick={() => setWhere(where === w ? null : w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}
      </section>
      <section className={`grid gap-3 ${session ? "sm:grid-cols-4" : "sm:grid-cols-2"}`} aria-label="What are you feeling">
        {order.map((k) => { const o = OPTS[k]; const active = session?.flow === o.flow; return (
          <button key={k} disabled={!!busy} onClick={() => start(o.flow)} className={`card text-left p-4 hover:bg-cream transition ${active ? "ring-2 ring-sage/50" : ""}`}>
            <span className="block font-medium text-[15px]">{busy === o.flow ? "Starting…" : o.title}</span><span className="block text-[13px] text-ink2 mt-0.5">{o.sub}</span>
          </button>); })}
      </section>
      {err && <p role="alert" className="text-terra">{err}</p>}
      {session && (scripted ? <Guide key={session.id} sessionId={session.id} onExit={() => setSession(null)} /> : <Companion key={session.id} sessionId={session.id} mode={session.flow} onExit={() => setSession(null)} onFallback={() => setScripted(true)} />)}
      {session && !scripted && <p className="text-[13px] text-ink2">Prefer simple spoken steps without a live conversation? <button className="underline" onClick={() => setScripted(true)}>Use guided steps</button></p>}
    </div>
  );
}
export default function Page() { return <Suspense><Now /></Suspense>; }
