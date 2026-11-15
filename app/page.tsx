"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";

const CARDS = [
  { flow: "panic", title: "Panic & Bodily Dread", body: "Racing pulse, cold sweat, fast breathing, a tight, fearful body.", tag: "Slow breathing & grounding", icon: "M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" },
  { flow: "intrusive", title: "Looping & Sticky Thoughts", body: "Catastrophizing, spirals, checking, urgency and dread.", tag: "Letting thoughts pass", icon: "M12 4a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11Zm-2 16h4" },
  { flow: "overwhelm", title: "Sensory Overwhelm", body: "Too much at once. Too loud, too bright, shut down, can't cope.", tag: "Gentle 5-4-3-2-1", icon: "M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v5H4zm13 0h3v5h-3z" },
];
const WHERE = ["at home", "at work or school", "out in public", "in bed"] as const;

function Home() {
  const router = useRouter();
  const sos = useSearchParams().get("sos");
  const [session, setSession] = useState<{ id: string; flow: string } | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const auto = useRef(false);

  useEffect(() => { fetch("/api/research/warm").catch(() => {}); }, []); // pre-fetch trusted-source techniques (sends no personal data)

  async function start(flow: string, first?: string) {
    setBusy(flow); setErr("");
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow, where: where ?? undefined }) });
      if (!res.ok) throw new Error();
      const s = await res.json();
      setSession(null); setTimeout(() => setSession({ id: s.id, flow, ...(first ? { first } : {}) } as any), 0);
    } catch { setErr("I couldn't start. Please try again."); }
    setBusy("");
  }
  useEffect(() => { if (sos && !auto.current) { auto.current = true; start("panic"); router.replace("/"); } }, [sos]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8 fade-in">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Immediate step 1 of 1</p>
          <h1 className="mt-1 text-[2.3rem] lg:text-[2.8rem] leading-[1.1]">What does your body need right now?</h1>
          <p className="mt-2 text-ink2 prose-narrow">Tap what fits closest. I'll talk you through it, one step at a time. You don't have to explain anything.</p>
        </div>
        <span className="tag tag-stone">Zero typing needed</span>
      </section>

      <section aria-label="Where are you, optional" className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink2 mr-1">Where are you? <span className="text-ink2/70">(optional, it helps me tailor this)</span></span>
        {WHERE.map((w) => <button key={w} className="chip" aria-pressed={where === w} onClick={() => setWhere(where === w ? null : w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}
      </section>

      <section className="grid md:grid-cols-3 gap-4" aria-label="What are you feeling">
        {CARDS.map((c) => {
          const active = session?.flow === c.flow;
          return (
            <button key={c.flow} disabled={!!busy} onClick={() => start(c.flow)} className={`card text-left p-5 transition hover:-translate-y-0.5 ${active ? "ring-2 ring-sage/60" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="size-11 rounded-xl bg-mint/70 grid place-items-center" aria-hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154539" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg></span>
                {active && <span className="tag bg-sagedeep text-white">Active now</span>}
              </div>
              <h2 className="mt-4 text-[1.5rem]">{busy === c.flow ? "Starting…" : c.title}</h2>
              <p className="mt-1 text-[14.5px] text-ink2">{c.body}</p>
              <p className="mt-3 text-[13px] font-medium text-slate">{c.tag}</p>
            </button>
          );
        })}
      </section>
      {err && <p role="alert" className="text-terra">{err}</p>}

      {session ? (
        <Guide key={session.id} sessionId={session.id} first={(session as any).first} onExit={() => setSession(null)} />
      ) : (
        <>
          <section className="grid md:grid-cols-[1.3fr_1fr] gap-6 items-stretch">
            <article className="card p-7 flex flex-col justify-between gap-6" style={{ background: "linear-gradient(140deg, #fff 0%, rgba(188,237,220,.35) 100%)" }}>
              <div>
                <p className="eyebrow">How this works</p>
                <h2 className="mt-1 text-[1.9rem]">I'll guide you. You just follow along.</h2>
                <ul className="mt-4 space-y-2.5 text-ink2">
                  <li className="flex gap-3"><span className="text-sage font-semibold">1</span>I tell you exactly what to do, in a calm voice, step by step.</li>
                  <li className="flex gap-3"><span className="text-sage font-semibold">2</span>While we go, I look up techniques on trusted health sites for what you're facing.</li>
                  <li className="flex gap-3"><span className="text-sage font-semibold">3</span>You can talk to me, slow me down, or switch techniques at any time.</li>
                </ul>
              </div>
              <button onClick={() => start("panic")} disabled={!!busy} className="b b-primary self-start">I'm panicking right now</button>
            </article>
            <div className="grid gap-4">
              <a href="/diary" className="card p-5 hover:-translate-y-0.5 transition"><p className="eyebrow">Want to talk it out?</p><h3 className="mt-1 text-[1.35rem]">Voice Diary</h3><p className="text-[14.5px] text-ink2">Say everything that's on your mind. I'll listen without judging, and keep a gentle record if you want one.</p></a>
              <a href="/care" className="card p-5 hover:-translate-y-0.5 transition"><p className="eyebrow">When you're ready</p><h3 className="mt-1 text-[1.35rem]">Find care near you</h3><p className="text-[14.5px] text-ink2">Therapists and groups by location and insurance, from public pages, with sources.</p></a>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Home /></Suspense>; }
