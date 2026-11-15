"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const until = (iso: string) => { const d = (new Date(iso).getTime() - Date.now()) / 864e5; return d < 0 ? "was earlier" : d < 1 ? "later today" : d < 2 ? "tomorrow" : `in ${Math.round(d)} days`; };
const post = (body: object) => fetch("/api/therapy", { method: "POST", body: JSON.stringify(body) });
const local = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function Therapy() {
  const [d, setD] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ therapist_name: "", modality: "", frequency: "weekly", next: "" });
  const [hw, setHw] = useState("");
  const [prep, setPrep] = useState<any>(null);
  const [prepBusy, setPrepBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => fetch("/api/therapy").then((r) => r.json()).then(setD).catch(() => setD({ plan: null, homework: [], sessions: [] })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d?.plan) setForm({ therapist_name: d.plan.therapist_name ?? "", modality: d.plan.modality ?? "", frequency: d.plan.frequency, next: local(d.plan.next_at) }); }, [d?.plan]);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    await post({ action: "plan", therapist_name: form.therapist_name || undefined, modality: form.modality || undefined, frequency: form.frequency, next_at: form.next ? new Date(form.next).toISOString() : null });
    setEdit(false); load();
  }
  async function getReady() {
    setPrepBusy(true); setPrep(null);
    const j = await fetch("/api/therapy/prep", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setPrep(j); setPrepBusy(false);
  }
  const copy = async (t: string, m = "Copied.") => { try { await navigator.clipboard.writeText(t); setMsg(m); setTimeout(() => setMsg(""), 3000); } catch {} };

  if (!d) return <p className="text-ink2">Loading…</p>;
  const { plan, homework, sessions, adherence } = d;
  const open = homework.filter((h: any) => !h.done_at), done = homework.filter((h: any) => h.done_at);
  const past = plan?.next_at && new Date(plan.next_at).getTime() < Date.now();
  const planForm = (
    <form onSubmit={savePlan} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="text-[13px] text-ink2">Therapist's name</span><input value={form.therapist_name} onChange={(e) => setForm({ ...form, therapist_name: e.target.value })} className="mt-1" /></label>
        <label className="block"><span className="text-[13px] text-ink2">Kind of therapy (optional)</span><input value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} placeholder="CBT, ERP, group…" className="mt-1" /></label>
        <label className="block"><span className="text-[13px] text-ink2">How often</span><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="mt-1"><option value="weekly">Every week</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select></label>
        <label className="block"><span className="text-[13px] text-ink2">Next appointment</span><input type="datetime-local" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className="mt-1" /></label>
      </div>
      <div className="flex gap-2"><button className="b b-primary">Save</button>{plan && <button type="button" onClick={() => setEdit(false)} className="b b-soft">Cancel</button>}</div>
    </form>
  );

  return (
    <div className="max-w-[680px] mx-auto space-y-8 fade-in">
      <section><h1>Your therapy</h1><p className="mt-1.5 text-ink2">Keep your sessions and homework in one place, and walk in prepared. Nothing here is shared unless you copy it.</p></section>

      {!plan || edit ? (
        <section className="card p-5 space-y-3"><h2>{plan ? "Edit your plan" : "Set up your therapy"}</h2>{planForm}
          {!plan && <p className="text-[13.5px] text-ink2">No therapist yet? <Link className="underline" href="/care">Find one near you</Link>.</p>}</section>
      ) : (
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[13px] text-ink2">Next session</p>
              <p className="serif text-[1.5rem] leading-tight mt-0.5">{plan.next_at ? `${day(plan.next_at)}, ${time(plan.next_at)}` : "Not scheduled yet"}</p>
              <p className="text-[14.5px] text-ink2 mt-0.5">{[plan.therapist_name, plan.modality].filter(Boolean).join(" · ") || "Your therapist"}{plan.next_at ? ` · ${until(plan.next_at)}` : ""}</p></div>
            <button onClick={() => setEdit(true)} className="text-[13.5px] underline text-ink2 min-h-10">Edit</button>
          </div>
          {past ? (
            <div className="mt-4 card-flat p-4"><p className="font-medium">Did you make it to this session?</p>
              <div className="mt-2 flex gap-2"><button onClick={async () => { await post({ action: "session_log", attended: true }); load(); }} className="b b-primary">Yes, I went</button><button onClick={async () => { await post({ action: "session_log", attended: false }); load(); }} className="b b-soft border border-line">I missed it</button></div></div>
          ) : <div className="mt-4"><button onClick={getReady} disabled={prepBusy} className="b b-primary">{prepBusy ? "Putting it together…" : "Help me get ready"}</button></div>}
        </section>
      )}

      {prep && !prep.error && (
        <section className="card p-5 space-y-4 fade-in"><h2>What to bring this time</h2>
          {[["Worth raising", prep.bring], ["What went better", prep.wins], ["What's been hard", prep.struggles], ["Questions you could ask", prep.questions]].map(([t, items]: any) => items?.length > 0 && (
            <div key={t}><p className="text-[13.5px] font-medium text-ink2">{t}</p><ul className="mt-1 space-y-1 list-disc pl-5 text-[15px]">{items.map((x: string) => <li key={x}>{x}</li>)}</ul></div>))}
          <div className="flex flex-wrap items-center gap-2"><button onClick={() => copy(prep.share, "Copied. Paste it into an email or bring it with you.")} className="b b-soft border border-line">Copy a summary for my therapist</button><span className="text-[12.5px] text-ink2">Self-reported, from your own logs. You choose whether to share it.</span></div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between"><h2>Homework</h2><span className="text-[13px] text-ink2">{done.length} of {homework.length} done</span></div>
        <div className="mt-1">
          {homework.length === 0 && <p className="py-3 text-ink2 text-[14.5px]">Nothing yet. Add what your therapist asks you to practice.</p>}
          {[...open, ...done].map((h: any) => (
            <div key={h.id} className="row">
              <button role="checkbox" aria-checked={!!h.done_at} onClick={async () => { await post({ action: "homework_toggle", id: h.id, done: !h.done_at }); load(); }} className="flex items-start gap-3 text-left flex-1 min-h-11">
                <span className={`box mt-0.5 ${h.done_at ? "!bg-sage !border-sage text-white" : ""}`}>{h.done_at && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}</span>
                <span><span className={`block text-[15px] ${h.done_at ? "line-through text-ink2" : ""}`}>{h.title}</span>{h.detail && <span className="block text-[13px] text-ink2">{h.detail}</span>}{!h.done_at && h.due_on && <span className="block text-[12.5px] text-ink2">Due {new Date(h.due_on).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}</span>
              </button>
              <button onClick={async () => { await post({ action: "homework_delete", id: h.id }); load(); }} className="text-[12.5px] text-ink2 underline min-h-10">Remove</button>
            </div>
          ))}
        </div>
        <form onSubmit={async (e) => { e.preventDefault(); if (!hw.trim()) return; await post({ action: "homework_add", title: hw.trim() }); setHw(""); load(); }} className="mt-2 flex gap-2"><input value={hw} onChange={(e) => setHw(e.target.value)} placeholder="Add a homework item" maxLength={120} /><button className="b b-soft border border-line shrink-0">Add</button></form>
      </section>

      {adherence && (
        <section><h2>How it's going</h2>
          <div className="mt-2 flex items-center gap-1.5" aria-label={`Attended ${adherence.attended} of the last ${adherence.total} sessions`}>{[...sessions].slice(0, 8).reverse().map((s: any) => <span key={s.id} title={`${day(s.held_at)}: ${s.attended ? "went" : "missed"}`} className={`size-3.5 rounded-full ${s.attended ? "bg-sage" : "bg-transparent border-2 border-terra"}`} />)}</div>
          <p className="mt-2 text-[15px] text-ink2">You made {adherence.attended} of your last {adherence.total} sessions.{adherence.lastMissed ? " You missed the most recent one. That happens, and getting back in soon tends to help." : adherence.attended === adherence.total ? " That's real consistency." : ""}</p>
          {adherence.lastMissed && <div className="mt-3 card-flat p-4 text-[14.5px]"><p className="text-ink2">A note you could send to reschedule:</p><p className="mt-1 italic">“Hi, I had to miss our last session and I'd like to get back on the schedule. Do you have a time this week or next?”</p><button onClick={() => copy("Hi, I had to miss our last session and I'd like to get back on the schedule. Do you have a time this week or next?")} className="mt-2 b b-soft border border-line">Copy this note</button></div>}
        </section>
      )}
      {msg && <p role="status" className="text-sage text-[14px]">{msg}</p>}
    </div>
  );
}
