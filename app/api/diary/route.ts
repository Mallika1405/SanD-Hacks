import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";
import { out } from "@/lib/speech";
import { diarySignals } from "@/lib/risk";

// Entries, patterns across them, and the short "listening sounds" the diary can make while she talks (signed so only these can be spoken).
export async function GET() {
  const device = await ensureDevice();
  const entries = await q<any>("SELECT id, created_at, title, summary, heard, feelings, themes, intensity, quote, duration_s, risk, risk_note, transcript IS NOT NULL AS has_transcript FROM diary_entries WHERE device_id=$1 ORDER BY created_at DESC LIMIT 60", [device]);
  const themes = await q<any>("SELECT t AS name, count(*)::int n FROM diary_entries, unnest(themes) t WHERE device_id=$1 GROUP BY t ORDER BY n DESC, t LIMIT 6", [device]);
  const feelings = await q<any>("SELECT f AS name, count(*)::int n FROM diary_entries, unnest(feelings) f WHERE device_id=$1 GROUP BY f ORDER BY n DESC, f LIMIT 6", [device]);
  const trend = await q<any>("SELECT created_at, intensity FROM diary_entries WHERE device_id=$1 AND intensity IS NOT NULL ORDER BY created_at DESC LIMIT 12", [device]);
  const listen = out(["Mm.", "I'm listening.", "Go on.", "I'm here.", "Take your time.", "That sounds like a lot.", "Mm-hm."].map((text) => ({ text, pause_ms: 0 })));
  const { trend: progress, signals } = diarySignals(entries);
  return NextResponse.json({ progress, signals, entries, patterns: { themes, feelings, trend: trend.reverse() }, listen });
}

export async function DELETE(req: Request) {
  const device = await ensureDevice();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await q("DELETE FROM diary_entries WHERE id=$1 AND device_id=$2", [id, device]);
  return NextResponse.json({ ok: true });
}
