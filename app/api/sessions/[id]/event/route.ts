import { NextResponse } from "next/server";
import { logEvent } from "@/lib/alerts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note, kind } = await req.json().catch(() => ({}));
  if (!note) return NextResponse.json({ error: "note" }, { status: 400 });
  await logEvent(null, id, kind ?? "note", String(note).slice(0, 500));
  return NextResponse.json({ ok: true });
}
