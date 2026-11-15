"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";
import Companion from "@/components/Companion";

type Card = { flow: string; title: string; body: string; tag: string; icon: string };
const CARDS: Record<string, Card> = {
  panic: { flow: "panic", title: "Panic & Bodily Dread", body: "Racing pulse, cold sweat, fast breathing, a tight, fearful body.", tag: "Slow breathing & grounding", icon: "M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" },
  intrusive: { flow: "intrusive", title: "Looping & Sticky Thoughts", body: "Intrusive thoughts, urges to check or seek reassurance, spirals.", tag: "Letting thoughts and urges pass", icon: "M12 4a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11Zm-2 16h4" },
  overwhelm: { flow: "overwhelm", title: "Sensory Overwhelm", body: "Too much at once. Too loud, too bright, shut down, can't cope.", tag: "Gentle 5-4-3-2-1", icon: "M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v5H4zm13 0h3v5h-3z" },
};
const WHERE = ["at home", "at work or school", "out in public", "in bed"] as const;

function Home() {
  const router = useRouter();
  const sos = useSearchParams().get("sos");
  const [session, setSession] = useState<{ id: string; flow: string } | null>(null);
  const [scripted, setScripted] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [me, setMe] = useState<{ account: any; profile: { name: string | null; conditions: string[]; onboarded: boolean } | null } | null>(null);
  const auto = useRef(false);

  useEffect(() => {
    fetch("/api/research/warm").catch(() => {}); // pre-fetch trusted-source techniques (sends no personal data)
    fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => setMe({ account: null, profile: null }));
  }, []);

  async function start(flow: string) {
    setBusy(flow); setErr(""); setScripted(false);
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow, where: where ?? undefined }) });
      if (!res.ok) throw new Error();
      const s = await res.json();
      setSession(null); setTimeout(() => setSession({ id: s.id, flow }), 0);
    } catch { setErr("I couldn't start. Please try again."); }
    setBusy("");
  }
  useEffect(() => { if (sos && !auto.current) { auto.current = true; start("panic"); router.replace("/"); } }, [sos]); // eslint-disable-line react-hooks/exhaustive-deps

  const conds = me?.profile?.conditions ?? [];
  const order = conds.includes("ocd") ? ["intrusive", "panic", "overwhelm"] : conds.includes("overwhelm") || conds.includes("gad") ? ["overwhelm", "panic", "intrusive"] : ["panic", "intrusive", "overwhelm"];
  const name = me?.profile?.name;
  const exit = () => setSession(null);

  return (
    <div className="space-y-8 fade-in">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{name ? `Hi, ${name}` : "Immediate step 1 of 1"}</p>
          <h1 className="mt-1 text-[2.3rem] lg:text-[2.8rem] leading-[1.1]">What does your body need right now?</h1>
          <p className="mt-2 text-ink2 prose-narrow">Tap what fits closest and I'll start talking with you. You don't have to explain anything.</p>
        </div>
        <span className="tag tag-stone">Zero typing needed</span>
      </section>

      {me && !me.profile?.onboarded && !session && (
        <a href="/welcome" className="card-flat p-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[15px]"><b>Make this yours.</b> Tell me what you're working through so I can tailor the guidance and your tracker.</span><span className="b b-primary !min-h-[40px]">Set up my profile</span></a>
      )}

      <section aria-label="Where are you, optional" className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink2 mr-1">Where are you? <span className="text-ink2/70">(optional)</span></span>
        {WHERE.map((w) => <button key={w} className="chip" aria-pressed={where === w} onClick={() => setWhere(where === w ? null : w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}
      </section>

      <section className="grid md:grid-cols-3 gap-4" aria-label="What are you feeling">
        {order.map((k) => {
          const c = CARDS[k]; const active = session?.flow === c.flow;
          return (
            <button key={c.flow} disabled={!!busy} onClick={() => start(c.flow)} className={`card text-left p-5 transition hover:-translate-y-0.5 ${active ? "ring-2 ring-sage/60" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="size-10 rounded-xl bg-mint/70 grid place-items-center" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#154539" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg></span>
                {active && <span className="tag bg-sagedeep text-white">Active now</span>}
              </div>
              <h2 className="mt-4 text-[1.4rem]">{busy === c.flow ? "Starting…" : c.title}</h2>
              <p className="mt-1 text-[14.5px] text-ink2">{c.body}</p>
              <p className="mt-3 text-[13px] font-medium text-slate">{c.tag}</p>
            </button>
          );
        })}
      </section>
      {err && <p role="alert" className="text-terra">{err}</p>}

      {session ? (
        scripted
          ? <Guide key={session.id} sessionId={session.id} onExit={exit} />
          : <Companion key={session.id} sessionId={session.id} mode={session.flow} onExit={exit} onFallback={() => setScripted(true)} />
      ) : (
        <section className="grid md:grid-cols-[1.3fr_1fr] gap-6 items-stretch">
          <article className="card p-7 flex flex-col justify-between gap-6" style={{ background: "linear-gradient(140deg, #fff 0%, rgba(188,237,220,.35) 100%)" }}>
            <div>
              <p className="eyebrow">Someone to talk to</p>
              <h2 className="mt-1 text-[1.9rem]">Juno stays on the line with you.</h2>
              <p className="mt-3 text-ink2 prose-narrow">A real conversation, in a calm voice. In a hard moment, Juno tells you exactly what to do, one step at a time. When it eases, you can just talk. Juno remembers what helps you, and looks up techniques on trusted health sites for what you're facing.</p>
            </div>
            <div className="flex flex-wrap gap-3"><button onClick={() => start("panic")} disabled={!!busy} className="b b-primary">I'm panicking right now</button><button onClick={() => start("talk")} disabled={!!busy} className="b b-ghost">Just talk to me</button></div>
          </article>
          <div className="grid gap-4">
            {conds.includes("ocd") && <a href="/tracker" className="card p-5 hover:-translate-y-0.5 transition"><p className="eyebrow">For OCD</p><h3 className="mt-1 text-[1.35rem]">Urge tracker</h3><p className="text-[14.5px] text-ink2">Log urges and whether you delayed or resisted. See your progress over time.</p></a>}
            <a href="/diary" className="card p-5 hover:-translate-y-0.5 transition"><p className="eyebrow">Want to talk it out?</p><h3 className="mt-1 text-[1.35rem]">Voice Diary</h3><p className="text-[14.5px] text-ink2">Say everything on your mind. I'll listen without judging.</p></a>
            <a href="/care" className="card p-5 hover:-translate-y-0.5 transition"><p className="eyebrow">When you're ready</p><h3 className="mt-1 text-[1.35rem]">Find care near you</h3><p className="text-[14.5px] text-ink2">Therapists and groups by location and insurance, with sources.</p></a>
          </div>
        </section>
      )}
      {session && !scripted && <p className="text-[13px] text-ink2">Prefer simple spoken steps without a live conversation? <button className="underline" onClick={() => setScripted(true)}>Use guided steps instead</button></p>}
    </div>
  );
}
export default function Page() { return <Suspense><Home /></Suspense>; }
