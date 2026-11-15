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

  return (
    <div className="max-w-[640px] mx-auto space-y-8 fade-in">
      <section className="pt-2">
        <h1>{hello}{name ? `, ${name}` : ""}.</h1>
        <p className="mt-1.5 text-ink2 text-[1.02rem]">
          {!me ? " " : mood != null && mood >= 3 ? "That sounds like a lot right now. I'm here if you want company." : signal ? "I noticed something in your diary I'd like to check in about." : plan?.next_at ? `Your next session is ${day(plan.next_at)}, ${inDays(plan.next_at)}.` : personaFor(conds).todayLine}
        </p>
      </section>

      <section className="flex flex-wrap gap-2.5">
        <Link href="/now?sos=1" className="b b-primary">I need a hand right now</Link>
      </section>

      <section aria-label="How anxious are you right now">
        <h2>How anxious are you right now?</h2>
        <div className="mt-2.5 flex flex-wrap gap-2">{MOODS.map(([l], i) => <button key={l} className="chip" aria-pressed={mood === i} onClick={() => logMood(i)}>{l}</button>)}</div>
        {mood != null && <p className="mt-2.5 text-[14px] text-ink2">{mood >= 3 ? <>Thanks for telling me. <Link className="underline text-ink" href="/now?sos=1">Want to start something together?</Link></> : "Thanks. Noted."}</p>}
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

      <section>
        <h2>Today</h2>
        <div className="mt-1">
          {plan?.next_at && <Link href="/therapy" className="link-row"><span><span className="block font-medium text-[14.5px]">Therapy {day(plan.next_at)}, {time(plan.next_at)}</span><span className="block text-[13px] text-ink2">{plan.therapist_name ?? "Your therapist"}{open.length ? ` · ${open.length} homework item${open.length > 1 ? "s" : ""} open` : " · homework done"}</span></span><span className="text-ink2">→</span></Link>}
          {!plan && th && <Link href="/therapy" className="link-row"><span><span className="block font-medium text-[14.5px]">Keep up with your therapy</span><span className="block text-[13px] text-ink2">Add your appointments and homework</span></span><span className="text-ink2">→</span></Link>}
          {th?.adherence?.lastMissed && <Link href="/therapy" className="link-row"><span><span className="block font-medium text-[14.5px]">You missed your last session</span><span className="block text-[13px] text-ink2">Rescheduling soon can help you stay on track</span></span><span className="text-ink2">→</span></Link>}
          {due && <Link href="/now?mode=talk" className="link-row"><span><span className="block font-medium text-[14.5px]">You asked me to check in</span><span className="block text-[13px] text-ink2">A minute, whenever you're ready</span></span><span className="text-ink2">→</span></Link>}
          <Link href="/tracker" className="link-row"><span><span className="block font-medium text-[14.5px]">{conds.includes("ocd") ? "Log an urge" : conds.includes("panic") ? "Log a panic episode" : "How does today feel?"}</span><span className="block text-[13px] text-ink2">Under a minute</span></span><span className="text-ink2">→</span></Link>
          {dy?.entries?.[0] && <Link href="/diary" className="link-row"><span><span className="block font-medium text-[14.5px]">Last diary entry: {dy.entries[0].title}</span><span className="block text-[13px] text-ink2">{Math.max(0, Math.round((Date.now() - new Date(dy.entries[0].created_at).getTime()) / 864e5))} days ago</span></span><span className="text-ink2">→</span></Link>}
        </div>
      </section>

      {tr && tr.logs.length > 0 && (
        <section className="only-balanced">
          <h2>This week</h2>
          <p className="mt-1.5 text-[15px] text-ink2">{weekLine(tr.kind, tr.logs)}</p>
          {dy?.progress === "improving" && <p className="mt-1 text-[14px] text-sage">Your recent diary entries have felt a bit lighter than the ones before.</p>}
        </section>
      )}
    </div>
  );
}
