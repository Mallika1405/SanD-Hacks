"use client";
import { useEffect, useState } from "react";

export default function Handoff() {
  const [s, setS] = useState(0);
  useEffect(() => { const i = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  return (
    <main className="p-5 space-y-5">
      <p className="inline-block px-3 py-1 rounded-full bg-amber text-ground text-sm font-bold">DEMO — no real call is placed</p>
      <h1 className="text-3xl font-semibold">Connecting to 911…</h1>
      <p className="text-muted">In a real emergency, Haven would hand you to the dialer. Here is what would be shared with the dispatcher:</p>
      <ul className="bg-surface rounded-2xl p-4 space-y-2 text-sm">
        <li>📍 Live location (last update {s}s ago)</li><li>🕒 Timeline of this session</li><li>🧾 Description captured so far</li><li>👥 Contacts already alerted</li>
      </ul>
      <p className="text-sm text-muted">Haven never places a 911 call for you. If you are in danger, dial 911 yourself.</p>
      <a href="tel:911" className="block w-full min-h-14 rounded-2xl bg-coral text-ground font-bold text-center leading-[56px]" onClick={(e) => { if (!confirm("This will open your phone dialer for 911. Continue?")) e.preventDefault(); }}>Open phone dialer</a>
      <button onClick={() => history.back()} className="w-full min-h-12 rounded-2xl bg-surface">Back to Haven</button>
    </main>
  );
}
