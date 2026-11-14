import { NextResponse } from "next/server";
import { ackAlert } from "@/lib/alerts";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { contactId, kind } = await req.json().catch(() => ({}));
  if (!contactId || !(["watching", "responding"].includes(kind) || /^eta:\d{1,3}$/.test(String(kind)))) return NextResponse.json({ error: "bad" }, { status: 400 });
  const r = await ackAlert(token, contactId, kind);
  return r ? NextResponse.json({ ok: true, won: r.won, claimerName: (r as any).claimerName ?? null }) : NextResponse.json({ error: "not allowed" }, { status: 403 });
}
