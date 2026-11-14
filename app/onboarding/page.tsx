"use client";
import { useEffect, useState } from "react";
import { DEFAULT_CODE_PHRASE } from "@/lib/presets";

export default function Onboarding() {
  const [d, setD] = useState<any>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE_PHRASE);
  const [err, setErr] = useState("");
  const load = () => fetch("/api/contacts").then((r) => r.json()).then(setD);
  useEffect(() => { load(); setCode(localStorage.getItem("haven_code") || DEFAULT_CODE_PHRASE); }, []);
  async function add() {
    setErr("");
    const r = await fetch("/api/contacts", { method: "POST", body: JSON.stringify({ name, phone }) });
    if (!r.ok) return setErr((await r.json()).error || "Could not add");
    setName(""); setPhone(""); setConsent(false); load();
  }
  return (
    <main className="p-5 pb-10 space-y-6">
      <a href="/" className="text-sm text-muted underline min-h-11 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">Your people</h1>
      <p className="text-muted text-sm">They get a text first and only receive alerts after they reply YES. They can reply STOP any time.</p>
      {d && !d.user && <p className="text-amber text-sm">No user yet. Run <code>npm run seed</code>.</p>}
      <ul className="space-y-2">
        {d?.contacts?.map((c: any) => (
          <li key={c.id} className="bg-surface rounded-2xl p-4 flex items-center justify-between gap-2">
            <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.phone}</p></div>
            <div className="text-right text-sm">
              {c.opted_in_at ? <span className="text-teal">✓ Opted in</span> : <span className="text-amber">◌ Waiting for YES</span>}
              {!c.opted_in_at && !d.twilio && <button onClick={() => fetch(`/api/contacts/${c.id}`, { method: "POST" }).then(load)} className="block underline text-muted min-h-11">Mark opted in (demo)</button>}
              <button onClick={() => fetch(`/api/contacts/${c.id}`, { method: "DELETE" }).then(load)} className="block underline text-muted min-h-11">Remove</button>
            </div>
          </li>
        ))}
        {d && !d.contacts.length && <li className="text-muted text-sm">No contacts yet.</li>}
      </ul>
      <section className="bg-surface rounded-2xl p-4 space-y-3">
        <h2 className="font-medium">Add a contact</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full bg-ground rounded-xl px-3 min-h-11" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" className="w-full bg-ground rounded-xl px-3 min-h-11" />
        <label className="flex gap-3 text-sm min-h-11 items-center"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-5" />This person has agreed to be my Haven contact.</label>
        <button disabled={!consent || !name || !phone} onClick={add} className="w-full min-h-12 rounded-xl bg-accent text-ground font-semibold disabled:opacity-40">Send opt-in text</button>
        {err && <p role="alert" className="text-coral text-sm">{err}</p>}
      </section>
      <section className="bg-surface rounded-2xl p-4 space-y-2">
        <h2 className="font-medium">Code phrase</h2>
        <p className="text-xs text-muted">Say this out loud and I'll alert your contacts immediately. Saying "help" does the same.</p>
        <input value={code} onChange={(e) => { setCode(e.target.value); localStorage.setItem("haven_code", e.target.value); }} className="w-full bg-ground rounded-xl px-3 min-h-11" />
      </section>
    </main>
  );
}
