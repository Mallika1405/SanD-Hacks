"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton, toast as notify } from "@/components/Motion";

type Seg = { text: string; pause_ms: number; sig: string };
type Msg = { role: "user" | "assistant"; text: string };
type Draft = { title: string; summary: string; heard: string; feelings: string[]; themes: string[]; quote: string; intensity: number; risk?: string; risk_note?: string | null };
type Entry = { id: string; created_at: string; title: string; summary: string; heard: string; feelings: string[]; themes: string[]; intensity: number | null; quote: string | null; transcript: string | null; has_transcript: boolean; risk?: string; risk_note?: string | null };

const b64url = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Diary() {
  const [phase, setPhase] = useState<"idle" | "chat" | "working" | "review">("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState(false);
  const [interim, setInterim] = useState("");
  const [speakingNow, setSpeakingNow] = useState(false);
  const [readAloud, setReadAloud] = useState(true);
  const [sttOk, setSttOk] = useState(true);
  const [keep, setKeep] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [data, setData] = useState<{ entries: Entry[]; patterns: any; signals: { level: string; text: string; action: string }[]; progress: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [obs, setObs] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<null | "self_harm" | "medical">(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [started, setStarted] = useState(0);

  const rec = useRef<any>(null);
  const micOn = useRef(false);
  const pending = useRef("");
  const silence = useRef<any>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const voice = useRef("EXAVITQu4vr4xnSDxMaL");
  const msgsRef = useRef<Msg[]>([]);
  const busyRef = useRef(false);
  const readRef = useRef(true); readRef.current = readAloud;
  const thread = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => fetch("/api/diary").then((r) => r.json()).then((j) => setData(j)).catch(() => {}), []);
  useEffect(() => {
    load();
    fetch("/api/voices").then((r) => r.json()).then((j) => (voice.current = j.assigned?.diary ?? j.selected.id)).catch(() => {});
    if (!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) setSttOk(false);
    return () => { micOn.current = false; try { rec.current?.stop(); } catch {} audio.current?.pause(); };
  }, [load]);
  useEffect(() => { thread.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [msgs, interim, busy]);

  const flash = (m: string) => { notify(m); setToast(m); setTimeout(() => setToast(""), 4000); };

  /* ---- speech recognition (voice mode): sends after a natural pause ---- */
  const stopRec = () => { try { rec.current?.stop(); } catch {} rec.current = null; };
  const startRec = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSttOk(false); return; }
    if (rec.current || !micOn.current) return;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], tr = String(res[0].transcript).trim();
        if (!tr) continue;
        if (res.isFinal) pending.current = (pending.current + " " + tr).trim(); else live = tr;
      }
      setInterim((pending.current + " " + live).trim());
      clearTimeout(silence.current);
      silence.current = setTimeout(() => { const t = pending.current.trim(); pending.current = ""; setInterim(""); if (t) send(t); }, live ? 3500 : 1700);
    };
    r.onerror = (e: any) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { micOn.current = false; setMic(false); setSttOk(false); setErr("The microphone is blocked. You can type instead."); } };
    r.onend = () => { rec.current = null; if (micOn.current && !busyRef.current) setTimeout(() => startRec(), 200); };
    try { r.start(); rec.current = r; } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMic() {
    if (mic) { micOn.current = false; setMic(false); clearTimeout(silence.current); stopRec(); setInterim(""); return; }
    micOn.current = true; setMic(true); setErr(""); audio.current?.pause(); startRec();
  }

  const speak = (s: Seg) => {
    if (!readRef.current) { if (micOn.current) startRec(); return; }
    try {
      audio.current?.pause();
      const a = new Audio(`/api/sos/tts?t=${b64url(s.text)}&s=${s.sig}&v=${voice.current}`); audio.current = a;
      stopRec(); setSpeakingNow(true);
      const done = () => { setSpeakingNow(false); if (micOn.current) startRec(); };
      a.onended = done; a.onerror = done; a.play().catch(done);
    } catch { if (micOn.current) startRec(); }
  };

  async function turn(history: Msg[], opening = false) {
    busyRef.current = true; setBusy(true); stopRec();
    const j = await fetch("/api/diary/chat", { method: "POST", body: JSON.stringify({ messages: history.length ? history : [{ role: "user", text: "(starting)" }], opening }) }).then((r) => r.json()).catch(() => null);
    busyRef.current = false; setBusy(false);
    if (!j?.reply) { setErr("I couldn't answer just now. Your words are still here."); if (micOn.current) startRec(); return; }
    const next = [...history, { role: "assistant" as const, text: j.reply }];
    msgsRef.current = next; setMsgs(next);
    if (j.crisis) setCrisis(j.crisis);
    if (j.say?.[0]) speak(j.say[0]); else if (micOn.current) startRec();
  }

  function send(text: string) {
    const t = text.trim(); if (!t || busyRef.current) return;
    audio.current?.pause(); setSpeakingNow(false); setErr("");
    const next = [...msgsRef.current, { role: "user" as const, text: t }];
    msgsRef.current = next; setMsgs(next); setInput(""); turn(next);
  }

  function begin(withMic: boolean) {
    setErr(""); setDraft(null); msgsRef.current = []; setMsgs([]); setStarted(Date.now()); setPhase("chat");
    if (withMic) { micOn.current = true; setMic(true); } 
    turn([], true);
  }

  async function finish() {
    micOn.current = false; setMic(false); clearTimeout(silence.current); stopRec(); audio.current?.pause(); setSpeakingNow(false);
    const mine = msgsRef.current.filter((m) => m.role === "user").map((m) => m.text).join(" ").trim();
    if (mine.length < 20) { setPhase("idle"); setMsgs([]); msgsRef.current = []; setErr("There wasn't enough there to save. Talk a little more, or just come back later."); return; }
    setPhase("working"); setErr("");
    const r = await fetch("/api/diary/finish", { method: "POST", body: JSON.stringify({ transcript: mine }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setPhase("chat"); setErr(j.error ?? "Something went wrong."); return; }
    setDraft(j.draft); setPhase("review");
    if (j.crisis) setCrisis(j.crisis);
  }

  async function save() {
    if (!draft) return;
    const full = msgsRef.current.map((m) => `${m.role === "user" ? "Me" : "Anchor"}: ${m.text}`).join("\n").slice(0, 20000);
    const r = await fetch("/api/diary/save", { method: "POST", body: JSON.stringify({ ...draft, transcript: keep ? full : null, duration_s: Math.round((Date.now() - started) / 1000) }) });
    if (!r.ok) return setErr("I couldn't save that. Please try again.");
    setDraft(null); setPhase("idle"); setMsgs([]); msgsRef.current = []; flash("Saved to your diary, in your own words."); load();
  }
  const discard = () => { setDraft(null); setPhase("idle"); setMsgs([]); msgsRef.current = []; flash("Discarded. Nothing was saved."); };
  async function remove(id: string) { if (!confirm("Delete this entry? This can't be undone.")) return; await fetch(`/api/diary?id=${id}`, { method: "DELETE" }); load(); }
  async function observe() { setObs("Looking across your entries…"); const j = await fetch("/api/diary/observe", { method: "POST" }).then((r) => r.json()).catch(() => null); setObs(j?.text ?? "I couldn't do that just now."); }

  const trend: number[] = (data?.patterns.trend ?? []).map((t: any) => t.intensity);
  const spark = trend.length > 1 ? trend.map((v, i) => `${(i / (trend.length - 1)) * 220},${46 - (v / 10) * 42}`).join(" ") : "";

  return (
    <div className="max-w-[640px] mx-auto space-y-6 fade-in">
      <section className="max-w-[640px]">
        <h1 className="text-[2rem] leading-[1.15]">Talk it through</h1>
        <p className="mt-2 text-ink2">Say it out loud or write it. I'll talk back, ask a gentle question now and then, and keep your own words so you can look back on them. <a href="/voice" className="underline">Change the voice</a></p>
      </section>
      {data && (data.signals.length > 0 || data.progress === "improving") && (
        <section className="card p-5 space-y-2" style={data.signals.length ? { background: "var(--terra-soft)" } : { background: "var(--mint-soft)" }} aria-label="What I've noticed">
          {data.signals.map((sg) => (
            <div key={sg.text} className="space-y-2"><p className="font-medium">Something worth a second look</p><p className="text-[14.5px]">{sg.text} You don't have to carry this alone.</p>
              <div className="flex flex-wrap gap-2">{sg.action === "crisis" ? <><a href="tel:988" className="b b-terra">Call or text 988</a><a href="tel:911" className="b b-soft">Call 911 if you're in danger</a></> : <>
                <button onClick={async () => { try { await navigator.clipboard.writeText("Hi, I've been having a harder time lately and wanted to tell you before our next session. I've been writing about it in my diary and can share what I've written if that would help."); setCopied(true); } catch {} }} className="b b-primary">{copied ? "Copied. Paste it to your therapist." : "Copy a note to my therapist"}</button>
                <a href="/care" className="b b-soft">Find someone to talk to</a><a href="tel:988" className="b b-ghost">Call or text 988</a></>}</div></div>
          ))}
          {data.signals.length === 0 && data.progress === "improving" && <p className="text-[14.5px]"><b>Your last few entries have felt lighter</b> than the ones before. That's worth noticing.</p>}
          {data.signals.length > 0 && data.progress === "improving" && <p className="text-[13.5px] text-ink2">Your most recent entries have felt a little lighter, which is a good sign.</p>}
        </section>
      )}
      <div className="space-y-4">
        <section className="card p-5 lg:p-6 space-y-4" aria-label="Conversation">
          {phase === "idle" && (
            <div className="space-y-3">
              <p className="text-[15px] text-ink2">How would you like to do this?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <button onClick={() => begin(sttOk)} disabled={!sttOk} className="b b-primary">Talk to me</button>
                <button onClick={() => begin(false)} className="b b-soft border border-line">Write instead</button>
              </div>
              {!sttOk && <p className="text-[13px] text-ink2">Talking needs Chrome with the microphone allowed. Writing works anywhere.</p>}
              {err && <p role="alert" className="text-terra text-[14.5px]">{err}</p>}
            </div>
          )}

          {(phase === "chat" || phase === "working") && (
            <>
              <div ref={thread} className="space-y-3 max-h-[26rem] overflow-y-auto pr-1" aria-live="polite">
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <p className={`bubble ${m.role === "user" ? "me" : "it"}`}>{m.text}</p>
                  </div>
                ))}
                {interim && <div className="flex justify-end"><p className="bubble me" style={{ opacity: .65 }}>{interim}…</p></div>}
                {busy && <div className="bubble it !p-0 w-fit" aria-label="Typing"><span className="typing"><i /><i /><i /></span></div>}
              </div>
              {err && <p role="alert" className="text-terra text-[14px]">{err}</p>}
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={2} placeholder={mic ? "Listening… or type here" : "Write whatever's on your mind"} className="flex-1" />
                <button type="submit" disabled={!input.trim() || busy} className="b b-primary">Send</button>
              </form>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                {sttOk && <button onClick={toggleMic} aria-pressed={mic} className={`b ${mic ? "b-terra" : "b-soft border border-line"}`}>{mic ? (speakingNow ? "Speaking…" : "Listening. Tap to mute") : "Use my voice"}</button>}
                <button onClick={() => { setReadAloud(!readAloud); if (readAloud) { audio.current?.pause(); setSpeakingNow(false); } }} aria-pressed={readAloud} className="b b-ghost">{readAloud ? "Reading replies aloud" : "Replies are silent"}</button>
                <span className="flex-1" />
                <button onClick={finish} disabled={phase === "working"} className="b b-primary">{phase === "working" ? "Putting it together…" : "I'm done, save this"}</button>
              </div>
              <button role="switch" aria-checked={keep} onClick={() => setKeep(!keep)} className="check-row !min-h-[40px] text-[13.5px]"><span className="box">{keep && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span>Keep our full conversation, word for word, with this entry</span></button>
              <p className="text-[12.5px] text-ink2">Nothing is saved until you tap save. If you say something that sounds like you might be in danger, I'll show you where to get help right away. Anchor isn't a crisis line.</p>
            </>
          )}
          {phase === "review" && <p className="text-ink2 text-[14.5px]">Here's what I heard. Look it over below, then keep it or let it go.</p>}
        </section>

        <details className="card-flat p-4"><summary className="cursor-pointer text-[14px] font-medium min-h-10 flex items-center">Patterns over time</summary>
        <aside className="space-y-6 mt-3">
          <article className="card p-6">
            <h2 className="text-[1.5rem]">Over time</h2>
            {!data?.entries.length ? <p className="mt-2 text-[14.5px] text-ink2">Once you've saved a few entries, I'll show the themes and feelings that keep coming up.</p> : (
              <div className="mt-3 space-y-4">
                <div><p className="eyebrow">Recurring themes</p>
                  <ul className="mt-2 space-y-1.5">{data.patterns.themes.map((t: any) => <li key={t.name} className="flex items-center gap-2 text-[14.5px]"><span className="w-24 truncate">{t.name}</span><span className="h-2 rounded-full bg-sage/70" style={{ width: `${Math.min(100, t.n * 22)}px` }} /><span className="text-ink2 text-[13px]">{t.n}</span></li>)}{!data.patterns.themes.length && <li className="text-[14px] text-ink2">None yet.</li>}</ul></div>
                <div><p className="eyebrow">Feelings you named</p><div className="mt-2 flex flex-wrap gap-1.5">{data.patterns.feelings.map((f: any) => <span key={f.name} className="tag tag-sage">{f.name} · {f.n}</span>)}</div></div>
                {spark && <div><p className="eyebrow">How intense it felt</p><svg viewBox="0 0 220 50" className="w-full mt-1"><polyline fill="none" stroke="#2F5D50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={spark} /></svg><p className="text-[12px] text-ink2">Your own 1 to 10 ratings, oldest to newest. Self-reported, not clinical.</p></div>}
                <button onClick={observe} className="b b-ghost w-full">What do you notice?</button>
                {obs && <p className="card-flat p-4 text-[14.5px] text-ink2">{obs}</p>}
              </div>
            )}
          </article>
          <article className="card-flat p-5 text-[14px] text-ink2"><p className="font-semibold text-ink">Prefer to be guided?</p><p className="mt-1">If it's loud in your head right now, start with <a className="underline text-slate" href="/now?sos=1">a guided grounding</a> first. The diary will be here after.</p></article>
        </aside></details>
      </div>

      {/* ---------- review ---------- */}
      {phase === "review" && draft && (
        <section className="card p-6 lg:p-8 space-y-5 fade-in" aria-label="What I heard">
          {draft.risk && draft.risk !== "none" && <div className="card-flat p-4" style={{ background: "var(--terra-soft)" }}><p className="font-medium">{draft.risk === "urgent" ? "I want to make sure you have support right now." : "Something here sounds heavy."}</p><p className="text-[14.5px] mt-1">{draft.risk_note}</p><div className="mt-2 flex flex-wrap gap-2"><a href="tel:988" className="b b-terra">Call or text 988</a>{draft.risk === "urgent" && <a href="tel:911" className="b b-soft">Call 911 if you're in danger</a>}<a href="/care" className="b b-soft">Find someone to talk to</a></div></div>}
          <div><p className="eyebrow">What I heard</p><p className="serif mt-2 text-[1.5rem] leading-snug prose-narrow">{draft.heard}</p>
</div>
          <div className="divider pt-5 grid lg:grid-cols-2 gap-5">
            <div className="space-y-3"><label className="block"><span className="eyebrow">Title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1" /></label>
              <label className="block"><span className="eyebrow">Summary (edit anything that's off)</span><textarea rows={5} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="mt-1" /></label>
              {draft.quote && <p className="text-[14.5px] text-ink2 italic">“{draft.quote}”</p>}</div>
            <div className="space-y-4">
              <div><p className="eyebrow">Feelings</p><div className="mt-2 flex flex-wrap gap-2">{draft.feelings.map((f) => <button key={f} className="chip" onClick={() => setDraft({ ...draft, feelings: draft.feelings.filter((x) => x !== f) })} aria-label={`Remove ${f}`}>{f} ×</button>)}</div></div>
              <div><p className="eyebrow">Themes</p><div className="mt-2 flex flex-wrap gap-2">{draft.themes.map((f) => <button key={f} className="chip" onClick={() => setDraft({ ...draft, themes: draft.themes.filter((x) => x !== f) })} aria-label={`Remove ${f}`}>{f} ×</button>)}</div></div>
              <label className="block"><span className="eyebrow">How intense did it feel? {draft.intensity} / 10</span><input type="range" min={1} max={10} value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) })} className="!min-h-0 !p-0 !border-0 !bg-transparent accent-[#2F5D50]" /></label>
            </div>
          </div>
          <div className="flex flex-wrap gap-3"><button onClick={save} className="b b-primary">Save to my diary</button><button onClick={discard} className="b b-ghost">Discard, save nothing</button></div>
        </section>
      )}
      {phase === "working" && <p className="card-flat p-5 text-ink2" role="status">Putting together what you said…</p>}
      {toast && <p role="status" className="text-sage font-medium">{toast}</p>}


      <section className="space-y-4" aria-label="Past entries">
        <h2 className="text-[1.5rem]">Your entries</h2>
        {!data && <Skeleton lines={3} />}
        {data && !data.entries.length && <p className="card-flat p-5 text-ink2">Nothing saved yet. When you're ready, tap Talk to me or Write instead.</p>}
        <div className="space-y-3">
          {data?.entries.map((e) => (
            <article key={e.id} className="card p-5 space-y-2">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[12.5px] text-ink2">{when(e.created_at)}</p><h3 className="text-[1.2rem] leading-tight">{e.title}</h3></div><div className="flex items-center gap-1.5">{e.risk && e.risk !== "none" && <span className="tag tag-terra">Worth a second look</span>}{e.intensity != null && <span className="tag tag-stone">{e.intensity}/10</span>}</div></div>
              <p className="text-[14.5px] text-ink2">{e.summary}</p>{e.risk_note && e.risk !== "none" && <p className="text-[13.5px] text-terradeep">{e.risk_note}</p>}
              <div className="flex flex-wrap gap-1.5">{e.feelings.map((f) => <span key={f} className="tag tag-sage">{f}</span>)}{e.themes.map((f) => <span key={f} className="tag">{f}</span>)}</div>
              {open === e.id && e.transcript && <div className="card-flat p-4 text-[14px] text-ink2 whitespace-pre-wrap max-h-72 overflow-y-auto">{e.transcript}</div>}
              <div className="flex justify-between items-center pt-1">{e.transcript ? <button onClick={() => setOpen(open === e.id ? null : e.id)} className="text-[13px] underline min-h-10">{open === e.id ? "Hide my words" : "Read my words"}</button> : <span className="text-[12px] text-ink2">Summary only</span>}<button onClick={() => remove(e.id)} className="text-[13px] text-terra underline min-h-10">Delete</button></div>
            </article>
          ))}
        </div>
      </section>

      {crisis && (
        <>
          <div className="sheet-back" />
          <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-[70] overflow-y-auto grid place-items-center p-4">
            <div className="card max-w-[520px] w-full p-7 space-y-4">
              <span className="tag tag-terra">Help is here</span>
              <h2 className="text-[2rem] leading-tight">{crisis === "medical" ? "That could be a medical emergency." : "I'm really glad you said that out loud."}</h2>
              <p className="text-ink2">{crisis === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988. It's free, and someone answers day and night."}</p>
              <a href={crisis === "medical" ? "tel:911" : "tel:988"} className="b b-terra w-full !min-h-[56px] text-[17px]">{crisis === "medical" ? "Call 911" : "Call 988"}</a>
              {crisis !== "medical" && <a href="sms:988" className="b b-soft w-full border border-line">Text 988</a>}
              <a href="/crisis" className="b b-ghost w-full">More support options</a>
              <button onClick={() => setCrisis(null)} className="b w-full text-ink2 underline">I'm safe right now</button>
              <p className="text-[12px] text-ink2">Anchor is a demo and not a medical service or crisis line. It can't call anyone for you.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
