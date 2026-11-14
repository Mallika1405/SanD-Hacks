import { notFound } from "next/navigation";
import Evidence from "@/components/Evidence";
import { loadEvidence } from "@/lib/vault";

export const dynamic = "force-dynamic";
export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await loadEvidence("share_token", token);
  if (!e) notFound();
  return <main className="p-5 pb-12 space-y-4"><p className="text-xs text-muted">Read-only shared report. Link expires automatically.</p><Evidence e={JSON.parse(JSON.stringify(e))} /></main>;
}
