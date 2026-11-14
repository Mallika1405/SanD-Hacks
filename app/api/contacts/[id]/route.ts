import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await q("DELETE FROM contacts WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
// Dev-only: simulate the YES reply when Twilio is not configured.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.HAVEN_DEV !== "1") return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { id } = await params;
  await q("UPDATE contacts SET opted_in_at=now() WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
