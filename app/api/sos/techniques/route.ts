import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";

// What Bright Data has found so far for this session's situation (for the "where this comes from" panel).
export async function GET(req: Request) {
  const device = await currentDevice();
  const id = new URL(req.url).searchParams.get("session") ?? "";
  if (!device || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ status: null, items: [] });
  const [s] = await q<{ research: string | null; research_key: string | null }>("SELECT research, research_key FROM sessions WHERE id=$1 AND device_id=$2", [id, device]);
  if (!s?.research_key) return NextResponse.json({ status: s?.research ?? null, items: [] });
  const items = await q("SELECT title, source_name, source_url, checked_at FROM techniques WHERE situation_key=$1 ORDER BY checked_at DESC LIMIT 8", [s.research_key]);
  return NextResponse.json({ status: s.research, items });
}
