"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Evidence from "@/components/Evidence";

export default function VaultItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const r = useRouter();
  const [e, setE] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch(`/api/vault/${id}`).then((x) => x.json()).then(setE); }, [id]);
  async function share() {
    const j = await fetch(`/api/vault/${id}/share`, { method: "POST" }).then((x) => x.json());
    if (!j.url) return setMsg("Could not create link");
    if (navigator.share) navigator.share({ title: "Haven report", url: j.url }).catch(() => {});
    else { await navigator.clipboard.writeText(j.url).catch(() => {}); }
    setMsg(`Link (expires in ${j.expires_in_hours}h): ${j.url}`);
  }
  async function del() {
    if (!confirm("Permanently delete this session, clips, and transcript? This can't be undone.")) return;
    await fetch(`/api/vault/${id}`, { method: "DELETE" }); r.push("/vault");
  }
  if (!e) return <main className="p-6 text-muted">Loading…</main>;
  if (e.error) return <main className="p-6">Not found.</main>;
  return (
    <main className="p-5 pb-12 space-y-5">
      <a href="/vault" className="text-sm text-muted underline min-h-11 inline-flex items-center">← Vault</a>
      <Evidence e={e} />
      <div className="grid grid-cols-1 gap-3">
        <a href={`/api/vault/${id}/pdf`} className="min-h-12 rounded-2xl bg-accent text-ground font-semibold flex items-center justify-center">Export PDF</a>
        <button onClick={share} className="min-h-12 rounded-2xl bg-surface">Share link (48h)</button>
        <button onClick={del} className="min-h-12 rounded-2xl border border-coral text-coral">Delete everything</button>
      </div>
      {msg && <p role="status" className="text-xs text-muted break-all">{msg}</p>}
    </main>
  );
}
