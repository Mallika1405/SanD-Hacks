"use client";
import { useEffect, useState } from "react";

export default function Vault() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetch("/api/vault").then((r) => r.json()).then((j) => setRows(j.sessions)).catch(() => setRows([])); }, []);
  return (
    <main className="p-5 space-y-4">
      <a href="/" className="text-sm text-muted underline min-h-11 inline-flex items-center">← Home</a>
      <h1 className="text-2xl font-semibold">Evidence vault</h1>
      <p className="text-sm text-muted">Only sessions where you pressed Followed, Fake call, or Alert are saved here.</p>
      {!rows && <p className="text-muted">Loading…</p>}
      {rows?.length === 0 && <p className="bg-surface rounded-2xl p-4 text-muted text-sm">Nothing saved. That's a good thing.</p>}
      {rows?.map((s) => (
        <a key={s.id} href={`/vault/${s.id}`} className="block bg-surface rounded-2xl p-4 min-h-16">
          <p className="font-medium capitalize">{s.mode} · {new Date(s.started_at).toLocaleString()}</p>
          <p className="text-sm text-muted">{s.clips} clips · {s.alerts} alerts</p>
        </a>
      ))}
    </main>
  );
}
