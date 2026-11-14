"use client";
import { useEffect, useRef, useState } from "react";

export default function Dev() {
  const [state, setState] = useState<any>(null);
  const [alert, setAlert] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [hold, setHold] = useState(0);
  const timer = useRef<any>(null);

  useEffect(() => { fetch("/api/dev/state").then((r) => r.json()).then(setState); }, []);
  useEffect(() => {
    if (!alert) return;
    const f = () => fetch(`/api/alerts/${alert.token}`).then((r) => r.json()).then(setData);
    f(); const i = setInterval(f, 3000); return () => clearInterval(i);
  }, [alert]);

  async function fire() {
    const r = await fetch("/api/alerts", { method: "POST", body: JSON.stringify({ reason: "dev test", placeText: "Geisel Library", lat: 32.8812, lng: -117.2376 }) });
    setAlert(await r.json());
  }
  function down() {
    const start = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 1000); setHold(p);
      if (p >= 1) { clearInterval(timer.current); setHold(0); fire(); }
    }, 50);
  }
  function up() { clearInterval(timer.current); setHold(0); }
  const press = (callId: string) => fetch("/api/dev/press", { method: "POST", body: JSON.stringify({ callId, digit: "1" }) });

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Haven /dev</h1>
      <p className="text-muted text-sm">User: {state?.user?.name ?? "none (run npm run seed)"} · Twilio: {state?.twilio ? "live" : "dry-run"}</p>
      <ul className="text-sm text-muted">{state?.contacts?.map((c: any) => <li key={c.id}>{c.name} {c.phone}</li>)}</ul>
      <button onPointerDown={down} onPointerUp={up} onPointerLeave={up}
        className="w-full h-24 rounded-2xl bg-coral text-ground font-bold text-lg relative overflow-hidden select-none touch-none">
        <span className="absolute inset-y-0 left-0 bg-amber/60" style={{ width: `${hold * 100}%` }} />
        <span className="relative">Hold 1s to alert</span>
      </button>
      {data?.alert && (
        <section className="bg-surface rounded-2xl p-4 space-y-2">
          <p>Status: <b>{data.alert.status}</b>{data.alert.claimed_by_name && ` · ${data.alert.claimed_by_name} is responding`}</p>
          {data.calls.map((c: any) => (
            <div key={c.id} className="flex justify-between items-center text-sm">
              <span>{c.name} — {c.status}{c.digit ? ` (pressed ${c.digit})` : ""}</span>
              {!state?.twilio && <button onClick={() => press(c.id)} className="px-3 rounded-lg bg-accent text-ground">Press 1</button>}
            </div>
          ))}
          <ul className="text-xs text-muted">{data.events.map((e: any, i: number) => <li key={i}>{new Date(e.created_at).toLocaleTimeString()} {e.note ?? e.kind}</li>)}</ul>
          <a className="text-accent text-sm underline" href={`/r/${alert.token}`}>Responder page</a>
        </section>
      )}
    </main>
  );
}
