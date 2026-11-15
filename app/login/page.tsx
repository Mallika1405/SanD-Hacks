"use client";
import { useEffect, useState } from "react";

const DEMOS = [
  { handle: "maya_ocd", name: "Maya", blurb: "OCD, six weeks into ERP therapy" },
  { handle: "jordan_panic", name: "Jordan", blurb: "Panic attacks, CBT, one missed session" },
  { handle: "sam_burnout", name: "Sam", blurb: "Burnout and worry, a heavy recent entry" },
  { handle: "riley_social", name: "Riley", blurb: "Social anxiety, group therapy" },
  { handle: "alex_new", name: "Alex", blurb: "Brand new, almost nothing yet" },
];

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [handle, setHandle] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [demos, setDemos] = useState(false);
  useEffect(() => { setDemos(location.hostname === "localhost" || location.hostname === "127.0.0.1"); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch(mode === "in" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ handle, password, displayName: name || undefined }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return setErr(j.error ?? "Something went wrong."); }
    window.location.href = mode === "up" ? "/welcome" : "/";
  }
  async function guest() { await fetch("/api/auth/guest", { method: "POST" }); window.location.href = "/"; }
  async function demo(h: string) {
    setBusy(true); const r = await fetch("/api/auth/demo", { method: "POST", body: JSON.stringify({ handle: h }) });
    if (!r.ok) { setBusy(false); return setErr((await r.json().catch(() => ({}))).error ?? "Couldn't open that profile."); }
    window.location.href = "/";
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1fr]">
      <section className="px-6 py-10 lg:px-14 lg:py-16 flex flex-col justify-between gap-10" style={{ background: "linear-gradient(160deg, var(--mint) 0%, var(--canvas) 70%)" }}>
        <p className="serif text-[1.5rem]">anchor</p>
        <div className="max-w-[26rem] space-y-4">
          <h1 className="!text-[2.1rem] lg:!text-[2.6rem] leading-[1.1]">A calm place to land when your head is loud.</h1>
          <p className="text-ink2 text-[1.02rem]">Anchor has someone to talk to at 3am, a place to keep track of how you're really doing, and a way to keep up with the help you're getting.</p>
        </div>
        <p className="text-[13px] text-ink2 max-w-[34ch]">Anchor is a demo, not a medical service. In an emergency call 911, or call or text <a className="underline" href="tel:988">988</a>. <a className="underline" href="/crisis">More support</a></p>
      </section>

      <section className="px-6 py-10 lg:px-14 lg:py-16 flex flex-col justify-center gap-6">
        <div className="max-w-[24rem] w-full space-y-5">
          <div><h2 className="!text-[1.5rem]">{mode === "in" ? "Welcome back" : "Make it yours"}</h2><p className="text-ink2 text-[14px] mt-1">{mode === "in" ? "Sign in to pick up where you left off." : "An account keeps your profile, diary and tracker together. No email needed."}</p></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && <label className="block"><span className="text-[13px] text-ink2">What should I call you?</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1" autoComplete="nickname" /></label>}
            <label className="block"><span className="text-[13px] text-ink2">Username</span><input value={handle} onChange={(e) => setHandle(e.target.value)} className="mt-1" autoComplete="username" autoCapitalize="none" required /></label>
            <label className="block"><span className="text-[13px] text-ink2">Password{mode === "up" ? " (8 or more characters)" : ""}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={mode === "up" ? 8 : 1} /></label>
            {err && <p role="alert" className="text-terra text-[14px]">{err}</p>}
            <button disabled={busy} className="b b-primary w-full">{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="text-[13px] text-ink2">{mode === "in" ? "New here? " : "Already have an account? "}<button className="underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>{mode === "in" ? "Create an account" : "Sign in"}</button>{mode === "up" && <span> There's no email, so there's no password reset.</span>}</p>
          <button onClick={guest} className="text-[14px] text-ink2 underline">Continue without an account</button>

          {demos && (
            <div className="pt-5 border-t border-line">
              <p className="text-[13px] text-ink2 mb-2">Just looking around? Try a demo profile with sample history, or <a className="underline" href="/demo">follow the guided demo</a>:</p>
              <div>{DEMOS.map((d) => <button key={d.handle} disabled={busy} onClick={() => demo(d.handle)} className="link-row w-full text-left"><span><span className="block font-medium text-[14.5px]">{d.name}</span><span className="block text-[13px] text-ink2">{d.blurb}</span></span><span className="text-ink2">→</span></button>)}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
