import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { q } from "@/lib/db";

export const maxDuration = 60;

// Persist an audio clip. Only called by the client on Followed / Fake call / Panic.
export async function POST(req: Request) {
  const u = new URL(req.url), sessionId = u.searchParams.get("sessionId"), trigger = u.searchParams.get("trigger") ?? "manual";
  if (!sessionId) return NextResponse.json({ error: "sessionId" }, { status: 400 });
  const [s] = await q<{ persisted: boolean }>("SELECT persisted FROM sessions WHERE id=$1 AND status='active'", [sessionId]);
  if (!s?.persisted) return NextResponse.json({ error: "not persisting" }, { status: 409 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob not configured" }, { status: 503 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength < 500 || buf.byteLength > 12_000_000) return NextResponse.json({ error: "size" }, { status: 400 });
  const type = req.headers.get("content-type") || "audio/webm";
  const blob = await put(`clips/${sessionId}/${Date.now()}.${type.includes("mp4") ? "m4a" : "webm"}`, buf, { access: "public", addRandomSuffix: true, contentType: type });
  const dur = Number(u.searchParams.get("duration") ?? 0) || null;
  const [c] = await q("INSERT INTO clips(session_id,url,trigger,duration_s) VALUES ($1,$2,$3,$4) RETURNING id,url", [sessionId, blob.url, trigger, dur]);
  await q("INSERT INTO events(session_id,kind,note) VALUES ($1,'clip',$2)", [sessionId, `Audio clip saved (${trigger})`]);
  return NextResponse.json(c);
}
