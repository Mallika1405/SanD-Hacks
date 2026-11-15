"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";
import Companion from "@/components/Companion";

function Session() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id");
  const [scripted, setScripted] = useState(false);
  if (!id) { router.replace("/"); return null; }
  const exit = () => router.push("/");
  return scripted ? <Guide sessionId={id} first={sp.get("first")} onExit={exit} /> : <Companion sessionId={id} mode="talk" onExit={exit} onFallback={() => setScripted(true)} />;
}
export default function Page() { return <Suspense><Session /></Suspense>; }
