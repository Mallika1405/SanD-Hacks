"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { flow: "intrusive", title: "Racing thoughts", sub: "A thought won't let go" },
  { flow: "overwhelm", title: "Overwhelmed", sub: "It's all too much" },
  { flow: "talk", title: "Just talk to me", sub: "Say what's on your mind" },
  { href: "/breathe", title: "Breathe with me", sub: "No voice, just a pacer" },
];

export default function Home() {
  const r = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [due, setDue] = useState<{ id: string } | null>(null);

  useEffect(() => {
    fetch("/api/checkins/due").then((x) => x.json()).then((j) => setDue(j.due)).catch(() => {});
    fetch("/api/research/warm").catch(() => {}); // pre-fetch trusted-source techniques so they're ready when needed (sends no personal data)
  }, []);

  async function start(flow: string, checkinId?: string) {
    setBusy(flow); setErr("");
    try {
      const res = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow, checkinId }) });
      if (!res.ok) throw new Error();
      r.push(`/session?id=${(await res.json()).id}`);
    } catch { setErr("I couldn't start. Please try again."); setBusy(""); }
  }

  return (
    <main className="px-5 pt-5 pb-8 flex flex-col min-h-dvh fade-in">
      <header className="flex items-center justify-between">
        <span className="text-xl font-semibold tracking-tight">somewhere<span className="text-teal">.</span></span>
        <nav className="flex gap-1 text-[15px]">
          <a href="/voice" className="px-3 min-h-11 inline-flex items-center rounded-full text-muted hover:text-ink">Voice</a>
          <a href="/me" className="px-3 min-h-11 inline-flex items-center rounded-full text-muted hover:text-ink">You</a>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-6">
        <div className="orb-wrap sm" aria-hidden><i className="ring r3" /><i className="ring r2" /><i className="ring" /><div className="orb" /></div>
        <div className="space-y-2 max-w-[22rem]">
          <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Take a breath.<br />I'm here with you.</h1>
          <p className="text-muted text-lg leading-snug">You don't have to explain anything. Tap the button, and I'll talk you through it.</p>
        </div>
      </section>

      {due && (
        <button disabled={!!busy} onClick={() => start("checkin", due.id)} className="mb-3 bg-surface rounded-2xl p-4 flex items-center justify-between text-left">
          <span><span className="block font-medium">You asked me to check in.</span><span className="text-sm text-muted">A minute, whenever you're ready.</span></span>
          <span className="text-teal font-medium pl-3">Talk →</span>
        </button>
      )}

      <button disabled={!!busy} onClick={() => start("panic")} className="btn-primary w-full min-h-[76px] rounded-[26px] text-[1.35rem] font-semibold disabled:opacity-60">
        {busy === "panic" ? "Starting…" : "I'm panicking right now"}
      </button>
      {err && <p role="alert" className="text-coral text-center mt-2">{err}</p>}

      <div className="grid grid-cols-2 gap-3 mt-3">
        {OPTIONS.map((o: any) => {
          const body = (<><span className="block text-[1.05rem] font-medium leading-snug">{o.title}</span><span className="block text-sm text-muted mt-0.5">{o.sub}</span></>);
          return o.href
            ? <a key={o.title} href={o.href} className="bg-surface rounded-2xl p-4 text-left">{body}</a>
            : <button key={o.title} disabled={!!busy} onClick={() => start(o.flow)} className="bg-surface rounded-2xl p-4 text-left disabled:opacity-60">{busy === o.flow ? "Starting…" : body}</button>;
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <a href="/care" className="bg-surface rounded-2xl p-4"><span className="block font-medium">Find support</span><span className="block text-sm text-muted">Therapists and groups</span></a>
        <a href="tel:988" className="btn-help rounded-2xl p-4 text-left"><span className="block font-medium">Need a person now?</span><span className="block text-sm opacity-80">Call or text 988</span></a>
      </div>

      <p className="text-xs text-muted text-center pt-6 leading-relaxed">Somewhere is a demo and not a medical service or crisis line. If this is a medical emergency, call 911.</p>
    </main>
  );
}
