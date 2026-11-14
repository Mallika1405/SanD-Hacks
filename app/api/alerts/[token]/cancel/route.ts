import { NextResponse } from "next/server";
import { cancelAlert } from "@/lib/alerts";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { ownerSecret } = await req.json().catch(() => ({}));
  const a = await cancelAlert(token, String(ownerSecret ?? ""));
  return a ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not allowed" }, { status: 403 });
}
