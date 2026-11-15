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

  useEffect(() => { if (session) document.documentElement.dataset.immersive = "1"; else delete document.documentElement.dataset.immersive; return () => { delete document.documentElement.dataset.immersive; }; }, [session]);
  const order = conds.includes("ocd") ? ["intrusive", "panic", "overwhelm", "talk"] : ["panic", "intrusive", "overwhelm", "talk"];

  return (
    <div className={session ? "space-y-6" : "max-w-[560px] mx-auto space-y-6"}>
      {!session && (
        <section className="max-w-[560px]"><h1>What's going on right now?</h1><p className="mt-1.5 text-ink2">Pick the closest one. You don't have to explain anything. <Link href="/voice" className="underline">Change Juno's voice</Link></p></section>
      )}
      {!session && (
        <div className="max-w-[560px] space-y-3">
          <section className="space-y-2.5 step-in" aria-label="What are you feeling">
            {order.map((k) => { const o = OPTS[k]; return (
              <button key={k} disabled={!!busy} onClick={() => start(o.flow)} className="w-full text-left rounded-xl border border-line bg-linen px-4 py-3.5 hover:border-sage/50 transition">
                <span className="block font-medium">{busy === o.flow ? "Starting…" : o.title}</span><span className="block text-[13.5px] text-ink2">{o.sub}</span>
              </button>); })}
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
