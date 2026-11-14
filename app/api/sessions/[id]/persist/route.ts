import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { logEvent } from "@/lib/alerts";

// Called on Followed / Fake call / Panic: allows clips + transcript to be saved for this session.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trigger } = await req.json().catch(() => ({}));
  const r = await q("UPDATE sessions SET persisted=true WHERE id=$1 AND status='active' RETURNING id", [id]);
  if (r.length) await logEvent(null, id, "persist", `Evidence capture on (${trigger ?? "manual"})`);
  return NextResponse.json({ ok: r.length > 0 });
}
