"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guide from "@/components/Guide";

function Session() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id");
  if (!id) { router.replace("/"); return null; }
  return <Guide sessionId={id} first={sp.get("first")} onExit={() => router.push("/")} />;
}
export default function Page() { return <Suspense><Session /></Suspense>; }
