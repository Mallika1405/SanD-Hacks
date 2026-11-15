"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [handle, setHandle] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch(mode === "in" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ handle, password, displayName: name || undefined }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Something went wrong.");
    window.location.href = mode === "up" ? "/welcome" : "/";
  }
  return (
    <div className="max-w-[440px] mx-auto space-y-6 fade-in">
      <div><span className="tag">Your profile</span><h1 className="mt-3 text-[2.4rem] leading-tight">{mode === "in" ? "Welcome back." : "Make it yours."}</h1>
        <p className="mt-2 text-ink2">An account keeps your profile, diary and tracker together, so they're there next time and on other devices. No email needed.</p></div>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <div className="seg" role="group"><button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>Sign in</button><button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>Create account</button></div>
        {mode === "up" && <label className="block"><span className="text-[14px] text-ink2">What should I call you? (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1" autoComplete="nickname" /></label>}
        <label className="block"><span className="text-[14px] text-ink2">Username</span><input value={handle} onChange={(e) => setHandle(e.target.value)} className="mt-1" autoComplete="username" autoCapitalize="none" required /></label>
        <label className="block"><span className="text-[14px] text-ink2">Password {mode === "up" && "(at least 8 characters)"}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={mode === "up" ? 8 : 1} /></label>
        {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
        <button disabled={busy} className="b b-primary w-full">{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create my account"}</button>
        {mode === "up" && <p className="text-[12.5px] text-ink2">There's no email, so there's no password reset. Keep your password somewhere safe. Anything you've already saved on this browser becomes part of your account.</p>}
      </form>
      <button onClick={() => router.push("/")} className="text-ink2 underline min-h-12">Continue without an account</button>
    </div>
  );
}
