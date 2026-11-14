import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s] = await q<any>("SELECT id, user_id, mode, status, destination, expected_route, started_at FROM sessions WHERE id=$1", [id]);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const trail = await q("SELECT ST_Y(geom::geometry) lat, ST_X(geom::geometry) lng, recorded_at FROM location_points WHERE session_id=$1 ORDER BY recorded_at DESC LIMIT 200", [id]);
  const events = await q("SELECT kind, note, created_at FROM events WHERE session_id=$1 ORDER BY created_at", [id]);
  return NextResponse.json({ session: s, trail: trail.reverse(), events });
}
