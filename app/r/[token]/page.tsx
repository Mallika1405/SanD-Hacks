"use client";
import { use, useEffect, useState } from "react";

export default function Responder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const f = () => fetch(`/api/alerts/${token}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setErr(true));
    f(); const i = setInterval(f, 3000); return () => clearInterval(i);
  }, [token]);
  if (err) return <main className="p-6">This link has expired.</main>;
  if (!d) return <main className="p-6 text-muted">Loading…</main>;
  const a = d.alert;
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">{a.user_name} asked for help{a.place_text ? ` at ${a.place_text}` : ""}</h1>
      <p className="inline-block px-3 py-1 rounded-full bg-surface text-sm">
        {a.status === "claimed" ? `● ${a.claimed_by_name} is responding` : a.status === "cancelled" ? "✓ Cancelled — she is ok" : "◌ Waiting for a responder"}
      </p>
      <p className="text-muted text-sm">Haven does not replace 911. If this is an emergency, call 911.</p>
    </main>
  );
}
