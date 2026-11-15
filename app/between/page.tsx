"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const FLOW: Record<string, string> = { panic: "Panic & bodily dread", intrusive: "Looping thoughts", overwhelm: "Sensory overwhelm", unsure: "Guided grounding", checkin: "Check-in", talk: "Talk" };

export default function Between() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/me").then((x) => x.json()).then(setD).catch(() => setD({ sessions: [], prefs: null, saved: { providers: [], groups: [] }, diary: [], diaryCount: 0 }));
  useEffect(() => { load(); }, []);

  const on = !!d?.prefs?.checkins_opt_in;
  async function toggleCheckins() {
    setBusy(true);
    if (on) { await fetch("/api/checkins", { method: "DELETE" }); setMsg("Check-ins are off."); }
    else { await fetch("/api/checkins", { method: "POST", body: JSON.stringify({ hour: new Date().getHours() }) }); setMsg("Okay. I'll check in with you tomorrow."); }
    setBusy(false); load();
  }
  async function checkInNow() {
    setBusy(true);
    const c = await fetch("/api/checkins", { method: "POST", body: JSON.stringify({ inHours: 0 }) }).then((r) => r.json());
    const s = await fetch("/api/sos/start", { method: "POST", body: JSON.stringify({ flow: "checkin", checkinId: c.id }) }).then((r) => r.json());
    router.push(`/session?id=${s.id}`);
  }
  async function forget() { await fetch("/api/me", { method: "PATCH" }); setMsg("I've forgotten what helps."); load(); }
  async function wipe() {
    if (!confirm("Delete everything Somewhere has saved about you on this device? That includes your diary, history, preferences, check-ins, saved lists, and any cloned voice. This can't be undone.")) return;
    const j = await fetch("/api/me", { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) return setMsg("I couldn't delete your cloned voice, so nothing was removed. Please try again.");
    setMsg("Everything was deleted."); setTimeout(() => router.push("/"), 900);
  }

  return (
    <div className="space-y-8 fade-in">
      <section className="max-w-[760px]">
        <span className="tag tag-stone">Quiet recovery space · only what you choose to keep</span>
        <h1 className="mt-3 text-[2.6rem] lg:text-[3.2rem] leading-[1.08]">Between moments, quiet baseline.</h1>
        <p className="mt-3 text-ink2 prose-narrow">A low-key space that remembers what actually helped you. No streaks, no guilt for missed days, nothing here is clinical. You decide what's kept, and you can delete all of it.</p>
      </section>
      {!d && <p className="text-ink2">Loading…</p>}

      {d && (
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <article className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-[1.6rem]">Consented check-ins</h2><p className="text-[14.5px] text-ink2 mt-1 prose-narrow">After a session, if you say yes, I'll check in once the next day, and remember what helped. No push notifications: a card appears here and on the home screen.</p></div>
                <button role="switch" aria-checked={on} aria-label="Check-ins" disabled={busy} onClick={toggleCheckins} className={`shrink-0 w-14 h-8 rounded-full p-1 transition ${on ? "bg-sage" : "bg-stone"}`}><span className={`block size-6 rounded-full bg-white shadow transition ${on ? "translate-x-6" : ""}`} /></button>
              </div>
              <p className="card-flat p-3 text-[14px] text-ink2">{on ? (d.checkin ? `Next check-in: ${when(d.checkin.due_at)}` : "On. I'll set the next one after your next session.") : "Off. I won't check in unless you turn this on."}</p>
              <button onClick={checkInNow} disabled={busy} className="b b-ghost">Check in with me now</button>
            </article>

            <article className="card p-6 space-y-3">
              <div className="flex items-baseline justify-between"><h2 className="text-[1.6rem]">What helps you</h2><span className="text-[12.5px] text-ink2">Remembered only after you said yes</span></div>
              {d.prefs?.favorite || d.prefs?.hard_times ? (
                <ul className="space-y-2">
                  {d.prefs.favorite && <li className="card-flat p-4"><p className="eyebrow !text-terra">What helped</p><p className="serif text-[1.35rem]">{d.prefs.favorite}</p></li>}
                  {d.prefs.hard_times && <li className="card-flat p-4"><p className="eyebrow">Harder times</p><p className="text-[1.05rem]">{d.prefs.hard_times}</p></li>}
                </ul>
              ) : <p className="text-ink2">Nothing yet. When a technique helps, I'll offer to remember it.</p>}
              {(d.prefs?.favorite || d.prefs?.hard_times) && <button onClick={forget} className="b b-soft border border-line">Forget what helps</button>}
            </article>

            <article className="card p-6 space-y-3">
              <div className="flex items-baseline justify-between"><h2 className="text-[1.6rem]">Voice Diary</h2><a href="/diary" className="text-slate underline text-[14.5px]">Open</a></div>
              {d.diary?.length ? d.diary.map((e: any) => <a key={e.id} href="/diary" className="block card-flat p-4"><p className="text-[12.5px] text-ink2">{when(e.created_at)}</p><p className="serif text-[1.2rem]">{e.title}</p></a>) : <p className="text-ink2">No entries yet. Say what's on your mind whenever you want.</p>}
              {d.diaryCount > 3 && <p className="text-[13px] text-ink2">and {d.diaryCount - 3} more</p>}
            </article>
          </div>

          <aside className="space-y-6">
            <article className="card p-6 space-y-3"><h2 className="text-[1.6rem]">When you reached out</h2>
              {!d.sessions.length && <p className="text-ink2">No sessions yet.</p>}
              {d.sessions.slice(0, 8).map((s: any) => (
                <div key={s.id} className="card-flat p-4"><p className="font-semibold">{FLOW[s.flow] ?? s.flow} <span className="text-ink2 font-normal">· {when(s.started_at)}</span></p>
                  {s.tried.length > 0 && <p className="text-[13.5px] text-ink2">Tried: {[...new Set(s.tried)].join(", ")}</p>}
                  {s.helpful.length > 0 && <p className="text-[13.5px] text-sage">You said this helped: {s.helpful.join(", ")}</p>}</div>
              ))}
              <p className="text-[12px] text-ink2">Self-reported, never clinical.</p></article>

            <article className="card p-6 space-y-2"><h2 className="text-[1.6rem]">Saved support</h2>
              {!d.saved.providers.length && !d.saved.groups.length && <p className="text-ink2">Nothing saved. <a href="/care" className="underline text-slate">Find care</a></p>}
              {[...d.saved.providers, ...d.saved.groups].map((x: any) => <a key={x.id} href={x.source_url} target="_blank" rel="noreferrer" className="block card-flat p-3 underline text-slate">{x.name}</a>)}</article>

            <article className="card p-6 space-y-2"><h2 className="text-[1.6rem]">Your profile</h2>
              <p className="text-ink2 text-[14.5px]">{d.profile?.name ? `${d.profile.name} · ` : ""}{d.profile?.conditions?.length ? d.profile.conditions.join(", ") : "Not set up yet"}</p>
              <div className="flex flex-wrap gap-2"><a href="/welcome" className="b b-soft border border-line">Edit profile</a><a href="/tracker" className="b b-soft border border-line">Open my tracker</a></div></article>

            <article className="card p-6 space-y-2"><h2 className="text-[1.6rem]">Your voice</h2>
              <p className="text-ink2 text-[14.5px]">Currently: {d.prefs?.voice_name ? `${d.prefs.voice_name}${d.prefs.voice_kind === "clone" ? " (a voice you trust)" : ""}` : "default"}</p>
              <a href="/voice" className="b b-soft border border-line">Change voice</a></article>

            <article className="card-flat p-6 space-y-2"><h2 className="text-[1.3rem]">Delete my data</h2>
              <p className="text-[14px] text-ink2">Removes your diary, history, preferences, check-ins, saved lists and any cloned voice, on this device and at ElevenLabs.</p>
              <button onClick={wipe} className="b b-terrasoft w-full">Delete everything</button></article>
          </aside>
        </div>
      )}
      {msg && <p role="status" className="text-sage font-medium">{msg}</p>}
    </div>
  );
}
