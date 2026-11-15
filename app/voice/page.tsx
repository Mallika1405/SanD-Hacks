"use client";
import { useEffect, useRef, useState } from "react";
import { Skeleton, toast } from "@/components/Motion";

const PROMPT = "Read this out loud, slowly, in the voice you'd like to hear: “Take a slow breath in. And let it out. You're here, and you're okay in this moment. Let your shoulders drop a little. Feel your feet on the floor. There's no rush. We can take this one breath at a time.”";

export default function Voice() {
  const [d, setD] = useState<any>(null);
  const [playing, setPlaying] = useState("");
  const [saved, setSavedRaw] = useState("");
  const setSaved = (m: string) => { setSavedRaw(m); if (m) toast(m); };
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const a = useRef<HTMLAudioElement | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const timer = useRef<any>(null);
  const load = () => fetch("/api/voices").then((r) => r.json()).then(setD);
  useEffect(() => { load(); }, []);
  const b64 = (t: string) => { const b = new TextEncoder().encode(t); let s = ""; b.forEach((c) => (s += String.fromCharCode(c))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

  function preview(id: string) {
    a.current?.pause(); setPlaying(id);
    const el = new Audio(`/api/sos/tts?t=${b64(d.sample.text)}&s=${d.sample.sig}&v=${id}`); a.current = el;
    el.onended = () => setPlaying(""); el.onerror = () => setPlaying("");
    el.play().catch(() => setPlaying(""));
  }
  async function select(body: object, msg = "Saved.") {
    await fetch("/api/voices", { method: "POST", body: JSON.stringify(body) });
    setSaved(msg); load();
  }
  const [only, setOnly] = useState<"all" | "calming">("calming");
  async function startRec() {
    setErr("");
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(st); const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => { st.getTracks().forEach((t) => t.stop()); const b = new Blob(chunks, { type: rec.mimeType || "audio/webm" }); setFile(b); setFileName("Your recording"); clearInterval(timer.current); setRecording(false); };
      rec.start(); mr.current = rec; setRecording(true); setSecs(0); timer.current = setInterval(() => setSecs((x) => x + 1), 1000);
    } catch { setErr("I couldn't use the microphone. You can upload a recording instead."); }
  }
  async function createClone() {
    if (!file) return; setBusy(true); setErr("");
    const fd = new FormData(); fd.append("name", name); fd.append("consent", String(consent)); fd.append("file", file, "voice.webm");
    const r = await fetch("/api/voices/clone", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Something went wrong.");
    setFile(null); setFileName(""); setName(""); setConsent(false); setSaved(`Added ${j.name}'s voice. You'll find it at the top of the list.`); load();
  }
  async function deleteClone(id: string) {
    if (!confirm("Delete this voice? It will be removed from ElevenLabs too.")) return;
    const r = await fetch(`/api/voices/clone?id=${id}`, { method: "DELETE" });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error || "Couldn't delete.");
    setSaved("Voice deleted."); load();
  }

  const A = d?.assigned ?? {};
  const WHERE: [string, string][] = [["companion", "Juno (live talking)"], ["guide", "Guided exercises"], ["diary", "Diary"]];
  const mine = (d?.clones ?? []).map((c: any) => ({ id: c.voice_id, name: `${c.name}'s voice`, blurb: "A voice you added, with consent", tags: ["Yours"], mine: true }));
  const list = [...mine, ...(d?.presets ?? []).filter((p: any) => only === "all" || p.calming)];
  const usedBy = (id: string) => WHERE.filter(([k]) => A[k] === id).map(([, l]) => l);
  return (
    <main className="max-w-[820px] space-y-6 fade-in">
      <div><h1 className="text-[1.8rem]">Voices</h1>
        <p className="mt-1 text-ink2">Pick a voice that settles you. You can use one voice for everything, or a different one for Juno, the guided exercises and the diary.</p></div>
      {!d && <Skeleton lines={4} />}

      {d?.suggested && A.companion !== d.suggested.id && (
        <section className="card p-4 flex flex-wrap items-center justify-between gap-3" aria-label="Suggested voice">
          <div><p className="eyebrow">Suggested to start</p><p className="font-medium">{d.suggested.name}{d.suggested.soothing ? ", extra soothing" : ""}</p><p className="text-[13.5px] text-ink2 max-w-[52ch]">{d.suggested.note}</p></div>
          <div className="flex gap-2"><button onClick={() => preview(d.suggested.id)} className="b b-soft border border-line">{playing === d.suggested.id ? "Playing…" : "Play"}</button>
            <button onClick={async () => { await fetch("/api/voices", { method: "POST", body: JSON.stringify({ voice_id: d.suggested.id, target: "all" }) }); await fetch("/api/voices", { method: "POST", body: JSON.stringify({ soothing: d.suggested.soothing }) }); setSaved(`${d.suggested.name} will speak everywhere.`); load(); }} className="b b-primary">Use this</button></div>
        </section>
      )}

      {d && (
        <section className="card p-5 space-y-3" aria-label="Current voices">
          <p className="eyebrow">Right now</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {WHERE.map(([k, l]) => { const v = d.presets.find((p: any) => p.id === A[k]) ?? ((d.clones ?? []).find((c: any) => c.voice_id === A[k]) ? { name: `${(d.clones ?? []).find((c: any) => c.voice_id === A[k]).name}'s voice` } : null); return <div key={k} className="card-flat p-3"><p className="text-[13px] text-ink2">{l}</p><p className="font-medium">{v?.name ?? "Custom"}</p></div>; })}
          </div>
          <button role="switch" aria-checked={d.soothing} onClick={() => select({ soothing: !d.soothing }, d.soothing ? "Back to a natural pace." : "Extra soothing is on: slower, softer, steadier.")} className="check-row"><span className="box">{d.soothing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span><b>Extra soothing</b><span className="block text-[13px] text-ink2">Slower, softer and steadier. Applies to guided exercises and the diary. (Juno's live voice uses the voice you pick.)</span></span></button>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div className="seg" style={{ width: 260 }}><button aria-pressed={only === "calming"} onClick={() => setOnly("calming")}>Calming</button><button aria-pressed={only === "all"} onClick={() => setOnly("all")}>All voices</button></div>
        <p className="text-[13px] text-ink2">Tap Play to hear each one.</p>
      </div>

      <ul className="grid sm:grid-cols-2 gap-3">
        {list.map((p: any) => (
          <li key={p.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-medium">{p.name} {p.calming && <span className="tag tag-sage ml-1">calming</span>}{p.mine && <span className="tag ml-1">yours</span>}</p><p className="text-[13.5px] text-ink2">{p.blurb}</p><p className="text-[12px] text-ink2/80 mt-0.5">{p.tags.join(" · ")}</p></div>
              <button onClick={() => preview(p.id)} aria-label={`Preview ${p.name}`} className="b b-soft border border-line !min-h-10">{playing === p.id ? "Playing…" : "Play"}</button>
            </div>
            {p.mine && <button onClick={() => deleteClone(p.id)} className="text-[13px] text-terra underline">Delete this voice</button>}
            {usedBy(p.id).length > 0 && <p className="text-[12.5px] text-sage">Used for: {usedBy(p.id).join(", ")}</p>}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => select({ voice_id: p.id, target: "all" }, `${p.name} will speak everywhere.`)} className="chip">Use everywhere</button>
              {WHERE.map(([k, l]) => <button key={k} onClick={() => select({ voice_id: p.id, target: k }, `${p.name} will be ${l}.`)} aria-pressed={A[k] === p.id} className="chip">{l.split(" ")[0]}</button>)}
            </div>
          </li>
        ))}
      </ul>

      {d?.clone?.available && (
        <section className="card p-5 space-y-3" aria-label="Add a voice you trust">
          <h2>Add a voice you trust</h2>
          <p className="text-[14px] text-ink2">Hear the guidance in a voice that feels safe, like yours or someone close to you. You can add up to 5. They only ever say Anchor's own words, never anything typed in.</p>
          <div className="space-y-3">
            <label className="block"><span className="text-[13.5px] text-ink2">Whose voice is this?</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Me, Mom, a friend…" className="mt-1" /></label>
            <p className="text-[14px] card-flat p-3 leading-snug">{PROMPT}</p>
            <div className="flex flex-wrap gap-2 items-center">
              {!recording ? <button onClick={startRec} className="b b-soft border border-line">Record</button> : <button onClick={() => mr.current?.stop()} className="b b-terra">Stop ({secs}s)</button>}
              <label className="b b-soft border border-line cursor-pointer">Upload audio<input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setFileName(f.name); } }} /></label>
              {fileName && <span className="text-[13.5px] text-sage">✓ {fileName}</span>}
            </div>
            <p className="text-[12.5px] text-ink2">About a minute of clear speech works best.</p>
            <button role="switch" aria-checked={consent} onClick={() => setConsent(!consent)} className="check-row"><span className="box">{consent && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span><span>This is my voice, or the speaker has agreed to this use.</span></button>
            <button disabled={!file || !consent || !name.trim() || busy} onClick={createClone} className="b b-primary w-full">{busy ? "Creating…" : "Add this voice"}</button>
          </div>
        </section>
      )}
      {saved && <p role="status" className="text-sage text-[14px]">{saved}</p>}
      {err && <p role="alert" className="text-terra text-[14px]">{err}</p>}
      <p className="text-[12.5px] text-ink2">Anchor is a demo and not a medical service or crisis line.</p>
    </main>
  );
}
