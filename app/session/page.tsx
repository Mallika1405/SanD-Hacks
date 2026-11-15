"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Session() {
  const r = useRouter();
  const id = useSearchParams().get("id");
  if (!id) { r.replace("/"); return null; }
  return (
    <main className="p-6 flex flex-col min-h-dvh">
      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="orb" aria-hidden />
        <p aria-live="polite" className="text-2xl text-center leading-snug min-h-24">Connecting…</p>
      </div>
      <div className="grid grid-cols-2 gap-3 pb-2">
        <button className="min-h-16 rounded-2xl bg-surface text-lg">Pause</button>
        <button onClick={() => r.push("/")} className="min-h-16 rounded-2xl bg-surface text-lg">I'm okay now</button>
        <button className="col-span-2 min-h-16 rounded-2xl bg-coral text-ground text-lg font-bold">I need help now</button>
      </div>
      <p className="text-xs text-muted text-center pt-3">Somewhere is a demo and not a medical service or crisis line.</p>
    </main>
  );
}
export default function Page() { return <Suspense><Session /></Suspense>; }
