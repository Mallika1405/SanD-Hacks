import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { maybeRetry } from "@/lib/alerts";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [a] = await q<any>(
    `SELECT a.id, a.status, a.reason, a.place_text, a.claimed_at, a.created_at, a.expires_at, a.session_id,
            u.name AS user_name, c.name AS claimed_by_name,
            ST_Y(a.geom::geometry) AS lat, ST_X(a.geom::geometry) AS lng
     FROM alerts a JOIN users u ON u.id=a.user_id LEFT JOIN contacts c ON c.id=a.claimed_by
     WHERE a.token=$1`, [token]);
  if (!a || new Date(a.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 404 });
  await maybeRetry(a.id).catch(() => {});
  const calls = await q(
    `SELECT DISTINCT ON (ac.contact_id) ac.id, c.name, ac.status, ac.digit, ac.attempt
     FROM alert_calls ac JOIN contacts c ON c.id=ac.contact_id WHERE ac.alert_id=$1
     ORDER BY ac.contact_id, ac.attempt DESC`, [a.id]);
  const events = await q("SELECT kind, note, created_at FROM events WHERE alert_id=$1 ORDER BY created_at", [a.id]);
  let loc = null, trail: any[] = [], destination = null, mode = null;
  if (a.status !== "cancelled" && a.session_id) {
    trail = await q("SELECT ST_Y(geom::geometry) lat, ST_X(geom::geometry) lng, recorded_at FROM location_points WHERE session_id=$1 ORDER BY recorded_at DESC LIMIT 120", [a.session_id]);
    trail.reverse();
    loc = trail[trail.length - 1] ?? null;
    const [s] = await q<any>("SELECT destination, mode FROM sessions WHERE id=$1", [a.session_id]);
    destination = s?.destination ?? null; mode = s?.mode ?? null;
  }
  return NextResponse.json({ alert: a, calls, events, loc, trail, destination, mode });
}
