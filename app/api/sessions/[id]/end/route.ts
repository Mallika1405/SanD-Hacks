import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { logEvent } from "@/lib/alerts";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await q("UPDATE sessions SET status='ended', ended_at=now() WHERE id=$1", [id]);
  await logEvent(null, id, "session_end", "Session ended. Tracking stopped.");
  return NextResponse.json({ ok: true });
}
