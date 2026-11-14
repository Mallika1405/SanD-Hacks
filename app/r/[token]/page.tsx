"use client";
import { use, useEffect, useState } from "react";
import MapView from "@/components/MapView";

export default function Responder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [cid, setCid] = useState<string | null>(null);
  useEffect(() => setCid(new URLSearchParams(location.search).get("c")), []);
  const ack = (kind: string) => fetch(`/api/alerts/${token}/ack`, { method: "POST", body: JSON.stringify({ contactId: cid, kind }) });
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
      {cid && a.status !== "cancelled" && (
        <div className="flex gap-2">
          <button onClick={() => ack("watching")} className="flex-1 h-12 rounded-xl bg-surface text-ink">I'm watching</button>
          {a.kind === "alert" && a.status === "active" && <button onClick={() => ack("responding")} className="flex-1 h-12 rounded-xl bg-teal text-ground font-semibold">I'm responding</button>}
        </div>
      )}
      {cid && a.status === "claimed" && (
        <div className="flex gap-2 items-center text-sm"><span className="text-muted">ETA</span>{[5, 10, 15].map((m) => <button key={m} onClick={() => ack(`eta:${m}`)} className="px-4 rounded-xl bg-surface min-h-11">{m} min</button>)}</div>
      )}
      {d.loc ? (
        <>
          <MapView center={d.loc} className="h-80"
            markers={[{ lat: d.loc.lat, lng: d.loc.lng, color: "#FF7A6B", label: "Last location" }, ...(d.destination ? [{ lat: d.destination.lat, lng: d.destination.lng, color: "#5ED1C0", label: "Destination", shape: "pin" as const }] : [])]}
            lines={[{ coords: d.trail.map((t: any) => [t.lat, t.lng]), color: "#B8A4FF" }]} />
          <p className="text-sm text-muted">Last update {new Date(d.loc.recorded_at).toLocaleTimeString()}{d.destination ? ` · Heading to ${d.destination.name}` : ""}</p>
        </>
      ) : <p className="text-muted text-sm">{a.status === "cancelled" ? "Location sharing stopped." : "No location yet."}</p>}
      <p className="text-muted text-sm">Haven does not replace 911. If this is an emergency, call 911.</p>
    </main>
  );
}
