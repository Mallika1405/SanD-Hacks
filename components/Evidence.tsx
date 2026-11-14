"use client";
import MapView from "./MapView";

const t = (d: string) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function Evidence({ e }: { e: any }) {
  const trail = e.trail.map((p: any) => [p.lat, p.lng] as [number, number]);
  const chips = Object.entries(e.chips ?? {}) as [string, string][];
  return (
    <div className="space-y-5">
      <header><h1 className="text-2xl font-semibold capitalize">{e.session.mode} session</h1><p className="text-sm text-muted">{e.session.user_name} · {t(e.session.started_at)}</p></header>
      {chips.length > 0 && <section><h2 className="text-sm text-muted mb-2">Description captured</h2><div className="flex flex-wrap gap-2">{chips.map(([k, v]) => <span key={k} className="px-3 py-2 rounded-xl bg-surface text-sm"><span className="text-accent capitalize">{k.replace("_", "/")}</span> · {v}</span>)}</div></section>}
      <section className="bg-surface rounded-2xl p-4"><h2 className="text-sm text-muted mb-2">Timeline</h2><ul className="space-y-1 text-sm">{e.events.map((ev: any, i: number) => <li key={i}><span className="text-muted">{t(ev.created_at)}</span> {ev.note ?? ev.kind}</li>)}</ul></section>
      {e.alerts.length > 0 && <section className="bg-surface rounded-2xl p-4"><h2 className="text-sm text-muted mb-2">Alerts</h2>{e.alerts.map((a: any, i: number) => <p key={i} className="text-sm">{t(a.created_at)} · {a.kind} · {a.status}</p>)}</section>}
      {e.clips.length > 0 && <section className="space-y-2"><h2 className="text-sm text-muted">Audio clips</h2>{e.clips.map((c: any) => <div key={c.id}><p className="text-xs text-muted">{t(c.created_at)} · {c.trigger}</p><audio controls src={c.url} className="w-full" /></div>)}</section>}
      {e.transcript.length > 0 && <section className="bg-surface rounded-2xl p-4"><h2 className="text-sm text-muted mb-2">Transcript</h2>{e.transcript.map((l: any, i: number) => <p key={i} className="text-sm"><b>{l.role === "user" ? "Her" : "Haven"}:</b> {l.text}</p>)}</section>}
      {trail.length > 1 && <section><h2 className="text-sm text-muted mb-2">GPS trail</h2><MapView follow={false} center={{ lat: trail[trail.length - 1][0], lng: trail[trail.length - 1][1] }} lines={[{ coords: trail, color: "#B8A4FF" }]} markers={[{ lat: trail[0][0], lng: trail[0][1], color: "#5ED1C0", label: "Start" }, { lat: trail[trail.length - 1][0], lng: trail[trail.length - 1][1], color: "#FF7A6B", label: "Last" }]} /></section>}
    </div>
  );
}
