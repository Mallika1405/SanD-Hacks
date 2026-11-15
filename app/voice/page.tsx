"use client";
import { useEffect, useRef, useState } from "react";

const PROMPT = "Read this out loud, slowly, in the voice you'd like to hear: “Take a slow breath in. And let it out. You're here, and you're okay in this moment. Let your shoulders drop a little. Feel your feet on the floor. There's no rush. We can take this one breath at a time.”";

export default function Voice() {
  const [d, setD] = useState<any>(null);
  const [playing, setPlaying] = useState("");
  const [saved, setSaved] = useState("");
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
  async function select(body: object) {
    await fetch("/api/voices", { method: "POST", body: JSON.stringify(body) });
    setSaved("Saved on this device."); load();
  }
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
    setFile(null); setFileName(""); setName(""); setConsent(false); setSaved(`Done. Somewhere will now speak in ${j.name}'s voice.`); load();
  }
  async function deleteClone() {
    if (!confirm("Delete this voice? It will be removed from ElevenLabs too.")) return;
    const r = await fetch("/api/voices/clone", { method: "DELETE" });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error || "Couldn't delete.");
    setSaved("Voice deleted."); load();
  }

  const clone = d?.clone?.existing;
  return (
    <main className="p-5 pb-12 space-y-6">
      <a href="/" className="text-sm text-muted underline min-h-12 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">Choose a voice</h1>
      <p className="text-muted">Press play to hear each one. Pick the one that feels calmest.</p>
      {!d && <p className="text-muted">Loading…</p>}
      <ul className="space-y-3">
        {d?.presets.map((p: any) => (
          <li key={p.id} className="bg-surface rounded-2xl p-4 flex items-center justify-between gap-3">
            <div><p className="text-lg font-medium">{p.name}{d.selected.id === p.id ? " ✓" : ""}</p><p className="text-sm text-muted">{p.blurb}</p></div>
            <div className="flex gap-2">
              <button onClick={() => preview(p.id)} aria-label={`Preview ${p.name}`} className="px-4 min-h-12 rounded-xl bg-ground text-ink">{playing === p.id ? "Playing…" : "Play"}</button>
              <button onClick={() => select({ voice_id: p.id })} disabled={d.selected.id === p.id} className="px-4 min-h-12 rounded-xl bg-accent text-ground font-semibold disabled:opacity-40">{d.selected.id === p.id ? "Selected" : "Use"}</button>
            </div>
          </li>
        ))}
      </ul>

      {d?.clone?.available && (
        <section className="bg-surface rounded-2xl p-4 space-y-3" aria-label="A voice you trust">
          <h2 className="text-xl font-semibold">A voice you trust</h2>
          <p className="text-sm text-muted">Hear the guidance in a voice that feels safe, like yours or someone close to you. It only ever says Somewhere's own reviewed words, never anything typed in.</p>
          {clone ? (
            <div className="space-y-2">
              <p className="text-lg">{clone.name}'s voice {d.selected.kind === "clone" && "✓"}</p>
              <p className="text-xs text-muted">Consent saved {new Date(clone.consent_at).toLocaleString()}</p>
              <div className="flex gap-2">
                <button onClick={() => preview(clone.id)} className="px-4 min-h-12 rounded-xl bg-ground">{playing === clone.id ? "Playing…" : "Play"}</button>
                <button onClick={() => select({ use_clone: true })} disabled={d.selected.kind === "clone"} className="px-4 min-h-12 rounded-xl bg-accent text-ground font-semibold disabled:opacity-40">{d.selected.kind === "clone" ? "Selected" : "Use"}</button>
                <button onClick={deleteClone} className="px-4 min-h-12 rounded-xl bg-ground text-coral">Delete</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block"><span className="text-sm text-muted">Whose voice is this?</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Me, Mom, a friend…" className="mt-1 w-full bg-ground rounded-xl px-4 min-h-12" /></label>
              <p className="text-sm bg-ground rounded-xl p-3 leading-snug">{PROMPT}</p>
              <div className="flex flex-wrap gap-2 items-center">
                {!recording ? <button onClick={startRec} className="px-4 min-h-12 rounded-xl bg-ground">Record</button> : <button onClick={() => mr.current?.stop()} className="px-4 min-h-12 rounded-xl bg-coral text-ground font-semibold">Stop ({secs}s)</button>}
                <label className="px-4 min-h-12 rounded-xl bg-ground inline-flex items-center cursor-pointer">Upload audio<input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setFileName(f.name); } }} /></label>
                {fileName && <span className="text-sm text-teal">✓ {fileName}</span>}
              </div>
              <p className="text-xs text-muted">About a minute of clear speech works best.</p>
              <label className="flex gap-3 items-start text-sm min-h-12"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-6 mt-0.5" />This is my voice, or the speaker has agreed to this use.</label>
              <button disabled={!file || !consent || !name.trim() || busy} onClick={createClone} className="w-full min-h-14 rounded-2xl bg-accent text-ground font-bold disabled:opacity-40">{busy ? "Creating…" : "Create this voice"}</button>
            </div>
          )}
        </section>
      )}
      {saved && <p role="status" className="text-teal text-sm">{saved}</p>}
      {err && <p role="alert" className="text-coral text-sm">{err}</p>}
      <p className="text-xs text-muted">Somewhere is a demo and not a medical service or crisis line.</p>
    </main>
  );
}
