"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { applyMode, getMode, type Mode } from "@/components/ThemeProvider";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const FLOW: Record<string, string> = { panic: "Panic", intrusive: "Looping thoughts", overwhelm: "Overwhelm", unsure: "Guided grounding", checkin: "Check-in", talk: "Talk" };
const COND: Record<string, string> = { panic: "panic attacks", ocd: "OCD", gad: "constant worry", social: "social anxiety", overwhelm: "stress and burnout", other: "anxiety" };
const PAL: [string, string, string][] = [["sage", "Sage", "#2F5D50"], ["slate", "Slate", "#3D5A73"], ["sand", "Sand", "#7B5A3E"], ["mist", "Mist", "#575C94"]];

function Fold({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details open={open} className="card p-0 overflow-hidden group"><summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 font-medium"><span>{title}</span><span className="text-ink2 transition-transform group-open:rotate-90" aria-hidden>›</span></summary><div className="px-5 pb-5 space-y-4">{children}</div></details>;
}
function Seg({ label, value, opts, onPick }: { label: string; value: string; opts: [string, string][]; onPick: (v: string) => void }) {
  return <div><p className="text-[13.5px] text-ink2 mb-1.5">{label}</p><div className="seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onPick(v)}>{l}</button>)}</div></div>;
}

export default function You() {
  const [mode, setMode] = useState<Mode>("system");
  const [cv, setCv] = useState<{ save: boolean; items: any[] } | null>(null);
  const [openCv, setOpenCv] = useState<any>(null);
  const loadCv = () => fetch("/api/conversations").then((r) => r.json()).then(setCv).catch(() => {});
  useEffect(() => { loadCv(); }, []);
  useEffect(() => { setMode(getMode()); }, []);
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [ui, setUi] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    fetch("/api/me").then((x) => x.json()).then(setD).catch(() => setD({ sessions: [], prefs: null, saved: { providers: [], groups: [] } }));
    fetch("/api/ui/settings").then((x) => x.json()).then(setUi);
    fetch("/api/auth/me").then((x) => x.json()).then(setAuth);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function change(k: string, v: any) {
    const overrides = { ...(ui?.overrides ?? {}), [k]: v };
    setUi({ ...ui, overrides, settings: { ...ui.settings, [k]: v } });
    await fetch("/api/ui/settings", { method: "PUT", body: JSON.stringify({ overrides }) });
    window.dispatchEvent(new Event("sw-ui-changed"));
  }
  async function resetUi() { await fetch("/api/ui/settings", { method: "PUT", body: JSON.stringify({ reset: true }) }); window.dispatchEvent(new Event("sw-ui-changed")); load(); setMsg("Back to what's recommended for you."); }
  const on = !!d?.prefs?.checkins_opt_in;
  async function toggleCheckins() { if (on) await fetch("/api/checkins", { method: "DELETE" }); else await fetch("/api/checkins", { method: "POST", body: JSON.stringify({ hour: new Date().getHours() }) }); load(); }
  async function forget() { await fetch("/api/me", { method: "PATCH" }); setMsg("I've forgotten what helps."); load(); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  async function wipe() {
    if (!confirm("Delete everything Anchor has saved about you? That includes your account, diary, tracker, therapy plan, history, preferences and any cloned voice. This can't be undone.")) return;
    const j = await fetch("/api/me", { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) return setMsg("I couldn't delete your cloned voice, so nothing was removed. Please try again.");
    await fetch("/api/auth/logout", { method: "POST" }); router.push("/login");
  }

  if (!d || !ui) return <p className="text-ink2">Loading…</p>;
  const s = ui.settings;
  return (
    <div className="max-w-[680px] mx-auto space-y-9 fade-in">
      <section>
        <h1>{auth?.profile?.name ? `${auth.profile.name}'s space` : "You"}</h1>
        <p className="mt-1.5 text-ink2">{auth?.profile?.conditions?.length ? `Working on ${auth.profile.conditions.map((c: string) => COND[c] ?? c).join(" and ")}.` : "You haven't told me what you're working through yet."} <Link className="underline" href="/welcome">Edit</Link></p>
        <p className="mt-1 text-[13.5px] text-ink2">{auth?.account ? `Signed in as ${auth.account.handle}. ` : "You're using a guest profile that lives on this browser. "}{auth?.account ? <button className="underline" onClick={logout}>Log out</button> : <Link className="underline" href="/login">Make an account</Link>}</p>
      </section>

      <Fold title="How Anchor looks for you">
        <div>
          <p className="mt-1 text-[14.5px] text-ink2 prose-narrow">I looked up what design research says helps people with {ui.why.conditions.map((c: string) => COND[c] ?? c).join(" and ")}, and set this up to match. Change anything that doesn't feel right.</p></div>
        <div className="card p-5 space-y-4">
          <Seg label="Light or dark" value={mode} opts={[["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]]} onPick={(v) => { applyMode(v as Mode); setMode(v as Mode); }} />
          <div className="flex items-center justify-between gap-3"><div><p className="text-[13.5px] text-ink2">Voice</p><p className="text-[14.5px]">Pick calming voices for Juno, the guides and the diary.</p></div><Link href="/voice" className="b b-soft border border-line">Choose voices</Link></div>
          <Seg label="Spacing" value={s.density} opts={[["airy", "Roomy"], ["cozy", "Cozy"], ["compact", "Compact"]]} onPick={(v) => change("density", v)} />
          <Seg label="Movement" value={s.motion} opts={[["none", "None"], ["soft", "Gentle"], ["normal", "Normal"]]} onPick={(v) => change("motion", v)} />
          <Seg label="How much on screen" value={s.focus} opts={[["single", "Just what matters now"], ["balanced", "A bit more"]]} onPick={(v) => change("focus", v)} />
          <Seg label="Text size" value={String(s.fontScale <= 0.99 ? 0.95 : s.fontScale < 1.08 ? 1 : s.fontScale < 1.15 ? 1.1 : 1.2)} opts={[["0.95", "Small"], ["1", "Medium"], ["1.1", "Large"], ["1.2", "Larger"]]} onPick={(v) => change("fontScale", Number(v))} />
          <Seg label="Contrast" value={s.contrast} opts={[["normal", "Soft"], ["high", "High"]]} onPick={(v) => change("contrast", v)} />
          <div><p className="text-[13.5px] text-ink2 mb-1.5">Color mood <span className="text-ink2/80">(blues and greens are most often linked with calm, but no color is proven to calm a particular condition. Pick what feels good to you.)</span></p><div className="flex gap-2">{PAL.map(([k, l, c]) => <button key={k} aria-pressed={s.palette === k} onClick={() => change("palette", k)} className="chip"><i className="size-3.5 rounded-full" style={{ background: c }} />{l}</button>)}</div></div>
          <button onClick={resetUi} className="text-[13.5px] underline text-ink2">Reset to recommended</button>
        </div>
        {ui.why.rationale.length > 0 && (
          <details className="card-flat p-4"><summary className="cursor-pointer text-[14.5px] font-medium min-h-9 flex items-center">Why it's set up this way</summary>
            <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[14.5px] text-ink2">{ui.why.rationale.map((r: string) => <li key={r}>{r}</li>)}</ul>
            {ui.why.sources.length > 0 && <div className="mt-3 text-[13.5px]"><p className="text-ink2">Read by Bright Data and summarized by Gemini from:</p><ul className="mt-1 space-y-0.5">{ui.why.sources.map((x: any) => <li key={x.url}><a className="underline text-slate" target="_blank" rel="noreferrer" href={x.url}>{x.name}</a></li>)}</ul></div>}
            <p className="mt-2 text-[12.5px] text-ink2">Design guidance from public pages, not medical advice.</p></details>
        )}
      </Fold>

      <Fold title="Check-ins and what helps">
        <div className="mt-1">
          <div className="row"><span><span className="block text-[15px]">Check in with me the day after a hard session</span><span className="block text-[13px] text-ink2">{on ? (d.checkin ? `Next: ${when(d.checkin.due_at)}` : "On") : "Off. I won't check in unless you turn this on."}</span></span>
            <button role="switch" aria-checked={on} aria-label="Check-ins" onClick={toggleCheckins} className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition ${on ? "bg-sage" : "bg-stone"}`}><span className={`block size-6 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} /></button></div>
          <div className="row"><span><span className="block text-[15px]">What helps you</span><span className="block text-[13px] text-ink2">{d.prefs?.favorite ? `${d.prefs.favorite}${d.prefs.hard_times ? `, and ${d.prefs.hard_times} are harder` : ""}` : "Nothing remembered yet"}</span></span>{(d.prefs?.favorite || d.prefs?.hard_times) && <button onClick={forget} className="text-[13px] underline text-ink2 min-h-10">Forget</button>}</div>
          <Link href="/voice" className="link-row"><span><span className="block text-[15px]">Juno's voice</span><span className="block text-[13px] text-ink2">{d.prefs?.voice_name ?? "Default"}{d.prefs?.voice_kind === "clone" ? " (a voice you trust)" : ""}</span></span><span className="text-ink2">→</span></Link>
        </div>
      </Fold>

      <Fold title="Conversations with Juno">
        <p className="text-[14px] text-ink2">Your talks with Juno are saved here, word for word, so you can look back on them. Only you can see them.</p>
        <button role="switch" aria-checked={cv?.save !== false} onClick={async () => { await fetch("/api/conversations", { method: "POST", body: JSON.stringify({ save: cv?.save === false }) }); loadCv(); }} className="check-row"><span className="box">{cv?.save !== false && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span>Save my conversations with Juno</span></button>
        {cv && !cv.items.length && <p className="text-[14px] text-ink2">Nothing saved yet.</p>}
        {(cv?.items ?? []).map((c: any) => (
          <div key={c.id} className="card-flat p-4 space-y-1.5">
            <p className="text-[12.5px] text-ink2">{when(c.started_at)} · {FLOW[c.mode] ?? c.mode} · {c.lines} lines</p>
            <p className="text-[14.5px]">{c.summary ?? "A conversation with Juno."}</p>
            <div className="flex gap-3 text-[13px]">
              <button className="underline" onClick={async () => { if (openCv?.id === c.id) return setOpenCv(null); const j = await fetch(`/api/conversations?id=${c.id}`).then((r) => r.json()); setOpenCv(j.conversation); }}>{openCv?.id === c.id ? "Hide" : "Read it"}</button>
              <button className="underline text-terra" onClick={async () => { if (!confirm("Delete this conversation?")) return; await fetch(`/api/conversations?id=${c.id}`, { method: "DELETE" }); setOpenCv(null); loadCv(); }}>Delete</button>
            </div>
            {openCv?.id === c.id && <div className="max-h-72 overflow-y-auto space-y-2 pt-2">{(openCv.transcript ?? []).map((l: any, i: number) => <p key={i} className="text-[14px]"><b>{l.role === "user" ? "You" : "Juno"}:</b> {l.text}</p>)}</div>}
          </div>
        ))}
      </Fold>

      <Fold title="Recent sessions">
        <div className="mt-1">
          {!d.sessions.length && <p className="py-3 text-ink2 text-[14.5px]">No sessions yet.</p>}
          {d.sessions.slice(0, 5).map((x: any) => <div key={x.id} className="row"><span><span className="block text-[15px]">{FLOW[x.flow] ?? x.flow}</span>{x.helpful.length > 0 && <span className="block text-[13px] text-sage">Helped: {x.helpful.join(", ")}</span>}</span><span className="text-[13px] text-ink2">{when(x.started_at)}</span></div>)}
        </div>
      </Fold>

      {(d.saved.providers.length > 0 || d.saved.groups.length > 0) && <Fold title="Saved support"><div className="mt-1">{[...d.saved.providers, ...d.saved.groups].map((x: any) => <a key={x.id} href={x.source_url} target="_blank" rel="noreferrer" className="link-row"><span className="text-[15px]">{x.name}</span><span className="text-ink2">↗</span></a>)}</div></Fold>}

      <Fold title="Delete my data">
        <p className="mt-1 text-[14px] text-ink2 prose-narrow">Removes your account, diary, tracker, therapy plan, history, preferences and any cloned voice, here and at ElevenLabs.</p>
        <button onClick={wipe} className="mt-3 b b-terrasoft">Delete everything</button></Fold>
      {msg && <p role="status" className="text-sage text-[14px]">{msg}</p>}
    </div>
  );
}
