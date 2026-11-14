import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { q } from "@/lib/db";
import { loadEvidence } from "@/lib/vault";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await loadEvidence("id", id);
  return e ? NextResponse.json(e) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clips = await q<{ url: string }>("SELECT url FROM clips WHERE session_id=$1", [id]);
  if (clips.length && process.env.BLOB_READ_WRITE_TOKEN) await del(clips.map((c) => c.url)).catch(() => {});
  await q("DELETE FROM alerts WHERE session_id=$1", [id]);
  await q("DELETE FROM sessions WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
