"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS: { n: number; title: string; as: string; name: string; to: string; do: string; see: string }[] = [
  { n: 1, title: "Sign in and see it fit the person", as: "maya_ocd", name: "Maya", to: "/", do: "Look at Today. Maya has OCD, so the layout is calm and plain, the wording avoids reassurance, and her next therapy session is shown.", see: "A different person gets different words, spacing and colors." },
  { n: 2, title: "Pick a calming voice", as: "maya_ocd", name: "Maya", to: "/voice", do: "Press Play on a few calming voices, then Use everywhere. Try Extra soothing. Use \"Suggested to start\" for the research-based pick.", see: "Different voices for Juno, guided exercises and the diary." },
  { n: 3, title: "Panic, in the moment", as: "jordan_panic", name: "Jordan", to: "/now?sos=1", do: "Say \"I'm still panicking\" a couple of times.", see: "It explains what the body is doing, then moves to stronger, different actions (cold water, pushing a wall, counted breathing) instead of repeating itself." },
  { n: 4, title: "Talk it through in the diary", as: "riley_social", name: "Riley", to: "/diary", do: "Choose Talk to me or Write instead and say how a social moment went.", see: "A real conversation. It asks one gentle question, avoids pushing painful detail, and keeps your actual words." },
  { n: 5, title: "A diary that flags something serious", as: "sam_burnout", name: "Sam", to: "/", do: "Open Sam's Today and Diary.", see: "A heavy entry is flagged with 988, 911, a note to copy for their therapist, and a link to find care." },
  { n: 6, title: "Keep up with therapy", as: "jordan_panic", name: "Jordan", to: "/therapy", do: "Jordan missed a session. Look at the plan, homework and what to bring.", see: "Next session, \"did you go?\", homework checklist and attendance dots." },
  { n: 7, title: "Find a specific therapist", as: "sam_burnout", name: "Sam", to: "/care", do: "Keep \"A specific therapist\", set a city and insurance, and press Find options.", see: "Live results read from public pages, with names, credentials and sources, all marked unverified." },
  { n: 8, title: "Light and dark", as: "alex_new", name: "Alex", to: "/you", do: "Open You. Switch Light or dark, and look at \"why it's set up this way\".", see: "Layout settings come from research per condition, and you can override them." },
];

export default function Demo() {
  const r = useRouter();
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  async function go(s: (typeof STEPS)[number]) {
    setBusy(s.n); setErr("");
    const res = await fetch("/api/auth/demo", { method: "POST", body: JSON.stringify({ handle: s.as }) });
    if (!res.ok) { setBusy(0); setErr("Demo profiles only work on localhost. Run npm run seed first."); return; }
    r.push(s.to); r.refresh();
  }
  return (
    <div className="max-w-[720px] mx-auto space-y-6 fade-in">
      <section><h1>Demo walkthrough</h1><p className="mt-1.5 text-ink2">Eight stops, in order. Each button signs in as the right demo profile and opens the page. Run <code>npm run seed</code> once first.</p></section>
      {err && <p role="alert" className="text-terra text-[14px]">{err}</p>}
      <ol className="space-y-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[13px] text-ink2">Step {s.n}</p><p className="font-medium">{s.title}</p></div>
              <button onClick={() => go(s)} disabled={busy === s.n} className="b b-primary shrink-0">{busy === s.n ? "Opening…" : `Open as ${s.name}`}</button>
            </div>
            <p className="text-[14.5px]"><b>Do:</b> {s.do}</p>
            <p className="text-[14.5px] text-ink2"><b>You'll see:</b> {s.see}</p>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] text-ink2">Somewhere is a demo and not a medical service or crisis line.</p>
    </div>
  );
}
