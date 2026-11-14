import { q } from "./db";

export async function loadEvidence(where: "id" | "share_token", val: string) {
  const [s] = await q<any>(
    `SELECT s.id, s.mode, s.status, s.destination, s.started_at, s.ended_at, s.persisted, u.name AS user_name
     FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.${where}=$1 ${where === "share_token" ? "AND s.share_expires_at > now()" : ""}`, [val]);
  if (!s) return null;
  const [events, clips, transcript, alerts, trail, desc] = await Promise.all([
    q("SELECT kind, note, created_at FROM events WHERE session_id=$1 ORDER BY created_at", [s.id]),
    q("SELECT id, url, trigger, duration_s, created_at FROM clips WHERE session_id=$1 ORDER BY created_at", [s.id]),
    q("SELECT role, text, created_at FROM transcripts WHERE session_id=$1 ORDER BY created_at", [s.id]),
    q("SELECT kind, status, reason, place_text, created_at, claimed_at FROM alerts WHERE session_id=$1 ORDER BY created_at", [s.id]),
    q("SELECT ST_Y(geom::geometry) lat, ST_X(geom::geometry) lng, recorded_at FROM location_points WHERE session_id=$1 ORDER BY recorded_at", [s.id]),
    q("SELECT chips FROM descriptions WHERE session_id=$1", [s.id]),
  ]);
  return { session: s, events, clips, transcript, alerts, trail, chips: (desc[0] as any)?.chips ?? {} };
}
