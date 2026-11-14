import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export async function GET() {
  const rows = await q(
    `SELECT s.id, s.mode, s.started_at, s.ended_at, s.persisted,
       (SELECT count(*)::int FROM clips c WHERE c.session_id=s.id) clips,
       (SELECT count(*)::int FROM alerts a WHERE a.session_id=s.id) alerts
     FROM sessions s WHERE s.persisted ORDER BY s.started_at DESC LIMIT 50`);
  return NextResponse.json({ sessions: rows });
}
