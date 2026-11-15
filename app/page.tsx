"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { personaFor } from "@/lib/personas";

const MOODS: [string, number, number][] = [["Calm", 1, 5], ["A bit uneasy", 3, 4], ["Anxious", 5, 3], ["Very anxious", 7, 2], ["Panicking", 9, 1]];
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "long" });
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const inDays = (iso: string) => { const d = Math.round((new Date(iso).getTime() - Date.now()) / 864e5); return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`; };

function weekLine(kind: string, logs: any[]) {
  const wk = (a: number, b: number) => logs.filter((l) => { const age = (Date.now() - new Date(l.created_at).getTime()) / 864e5; return age >= a && age < b; }).map((l) => l.data);
  const now = wk(0, 7), prev = wk(7, 14);
  if (kind === "ocd_urge") {
    if (!now.length) return "No urges logged this week. If one comes up, logging it takes under a minute.";
    const good = (a: any[]) => a.filter((x) => x.response !== "did").length;
    return `This week you delayed or resisted ${good(now)} of ${now.length} urges${prev.length ? `, compared with ${good(prev)} of ${prev.length} the week before` : ""}.`;
  }
  if (kind === "panic_episode") {
    if (!now.length) return "No panic episodes logged this week.";
    const avg = (a: any[]) => Math.round(a.reduce((s, x) => s + x.minutes, 0) / a.length);
    return `${now.length} panic episode${now.length > 1 ? "s" : ""} this week, lasting about ${avg(now)} minutes each${prev.length ? ` (${avg(prev)} the week before)` : ""}.`;
  }
  if (!now.length) return "Nothing logged this week yet.";
  const avg = (a: any[]) => (a.reduce((s, x) => s + x.anxiety, 0) / a.length).toFixed(1);
  return `Your anxiety has averaged ${avg(now)} out of 10 this week${prev.length ? `, versus ${avg(prev)} last week` : ""}.`;
}

export default function Today() {
  const [me, setMe] = useState<any>(null);
  const [th, setTh] = useState<any>(null);
  const [dy, setDy] = useState<any>(null);
  const [tr, setTr] = useState<{ kind: string; logs: any[] } | null>(null);
  const [due, setDue] = useState<any>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((m) => {
      setMe(m);
      const c: string[] = m.profile?.conditions ?? [];
      const kind = c.includes("ocd") ? "ocd_urge" : c.includes("panic") ? "panic_episode" : "daily";
      fetch(`/api/tracker?kind=${kind}`).then((r) => r.json()).then((j) => setTr({ kind, logs: j.logs }));
    }).catch(() => setMe({}));
    fetch("/api/therapy").then((r) => r.json()).then(setTh).catch(() => {});
    fetch("/api/diary").then((r) => r.json()).then(setDy).catch(() => {});
    fetch("/api/checkins/due").then((r) => r.json()).then((j) => setDue(j.due)).catch(() => {});
    fetch("/api/research/warm").catch(() => {});
  }, []);

  const name = me?.profile?.name;
  const h = new Date().getHours();
  const hello = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const conds: string[] = me?.profile?.conditions ?? [];
  const plan = th?.plan, open = (th?.homework ?? []).filter((x: any) => !x.done_at);
  const signal = dy?.signals?.[0];

  async function logMood(i: number) {
    setMood(i);
    const [, anx, m] = MOODS[i];
    await fetch("/api/tracker", { method: "POST", body: JSON.stringify({ kind: "daily", data: { mood: m, anxiety: anx, helped: [] } }) }).catch(() => {});
  }
  async function copyNote() {
    const t = "Hi, I've been struggling more lately and wanted to let you know before our next session. I've been keeping notes in my diary and can share them if that would help.";
    try { await navigator.clipboard.writeText(t); setCopied(true); } catch {}
  }

  const MOOD_COLORS = ["#6FBF9F", "#A7C97A", "#E6C45E", "#E8955F", "#D1634A"];
  const Ico = ({ d }: { d: string }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: d }} />;
  const ICONS = { therapy: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>', track: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', diary: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M9 9h6M9 13h4"/>', talk: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>' };
  const Tile = ({ href, icon, tone = "", title, sub }: { href: string; icon: string; tone?: string; title: string; sub: string }) => (
    <Link href={href} className="tile"><span className={`ico ${tone}`}><Ico d={icon} /></span><span className="min-w-0 flex-1"><span className="block font-bold text-[15px] leading-snug">{title}</span><span className="block text-[13.5px] text-ink2 truncate">{sub}</span></span><span className="text-ink2" aria-hidden>→</span></Link>
  );

  return (
    <div className="max-w-[640px] mx-auto space-y-9">
      <section className="hero !grid-cols-1">
        <div>
          <p className="text-[13.5px] text-ink2 font-semibold tracking-wide uppercase">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2">{hello}{name ? <>,<br />{name}.</> : "."}</h1>
          <p className="mt-3 text-ink2 text-[1.05rem] max-w-[30ch]">
            {!me ? " " : mood != null && mood >= 3 ? "That sounds like a lot right now. I'm here if you want company." : signal ? "I noticed something in your diary I'd like to check in about." : plan?.next_at ? `Your next session is ${day(plan.next_at)}, ${inDays(plan.next_at)}.` : personaFor(conds).todayLine}
          </p>
        </div>
</section>

      <Link href="/now?sos=1" className="help-cta" aria-label="I need a hand right now. Start a guided moment with Juno.">
        <span className="ico" aria-hidden><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" /></svg></span>
        <span className="flex-1"><span className="block text-[17px] font-bold">I need a hand right now</span><span className="block text-[14px] opacity-85">Juno will talk you through it, step by step</span></span>
        <span aria-hidden className="text-xl">→</span>
      </Link>

      <section aria-label="How anxious are you right now" className="space-y-3">
        <h2>How anxious are you right now?</h2>
        <div className="mood" role="group" aria-label="Anxiety level">{MOODS.map(([l], i) => <button key={l} aria-pressed={mood === i} onClick={() => logMood(i)}><i style={{ background: mood === i ? "#fff" : MOOD_COLORS[i] }} />{["Calm", "Uneasy", "Anxious", "Very anxious", "Panicking"][i]}</button>)}</div>
        {mood != null && <p className="text-[14px] text-ink2">{mood >= 3 ? <>Thanks for telling me. <Link className="underline text-ink" href="/now?sos=1">Want to start something together?</Link></> : "Thanks. Noted."}</p>}
      </section>

      {signal && (
        <section className="card p-5" style={{ background: "var(--terra-soft)" }}>
          <h2>Something I noticed</h2>
          <p className="mt-1 text-[14.5px]">{signal.text} It might help to bring this to someone who can support you.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signal.action === "crisis" ? <a href="tel:988" className="b b-terra">Call or text 988</a> : <button onClick={copyNote} className="b b-primary">{copied ? "Copied. Paste it to your therapist." : "Copy a note to my therapist"}</button>}
            <Link href="/care" className="b b-soft">Find someone to talk to</Link>
            <Link href="/crisis" className="b b-ghost">Crisis support</Link>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2>For today</h2>
        <div className="space-y-3">
          {plan?.next_at && <Tile href="/therapy" icon={ICONS.therapy} title={`Therapy ${day(plan.next_at)}, ${time(plan.next_at)}`} sub={`${plan.therapist_name ?? "Your therapist"}${open.length ? ` · ${open.length} homework item${open.length > 1 ? "s" : ""} open` : " · homework done"}`} />}
          {!plan && th && <Tile href="/therapy" icon={ICONS.therapy} title="Keep up with your therapy" sub="Add your appointments and homework" />}
          {th?.adherence?.lastMissed && <Tile href="/therapy" tone="t3" icon={ICONS.therapy} title="You missed your last session" sub="Rescheduling soon can help you stay on track" />}
          {due && <Tile href="/now?mode=talk" tone="t4" icon={ICONS.talk} title="You asked me to check in" sub="A minute, whenever you're ready" />}
          <Tile href="/tracker" tone="t2" icon={ICONS.track} title={conds.includes("ocd") ? "Log an urge" : conds.includes("panic") ? "Log a panic episode" : "How does today feel?"} sub="Under a minute" />
          {dy?.entries?.[0] && <Tile href="/diary" tone="t4" icon={ICONS.diary} title={`Last diary entry: ${dy.entries[0].title}`} sub={`${Math.max(0, Math.round((Date.now() - new Date(dy.entries[0].created_at).getTime()) / 864e5))} days ago`} />}
        </div>
      </section>

      {tr && tr.logs.length > 0 && (
        <section className="only-balanced card p-5">
          <h2>This week</h2>
          <p className="mt-1.5 text-[15px] text-ink2">{weekLine(tr.kind, tr.logs)}</p>
          {dy?.progress === "improving" && <p className="mt-1 text-[14px] text-sage">Your recent diary entries have felt a bit lighter than the ones before.</p>}
        </section>
      )}
    </div>
  );
}
