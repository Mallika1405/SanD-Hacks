import { q } from "./db";

const CELL = 0.002; // ~200m grid
/** Anonymized: no user/session link. Coarse grid cell, hour-truncated time, randomized 30-120 min visibility delay. */
export async function recordIncident(lat: number, lng: number, kind: string) {
  const ci = Math.round(lat / CELL), cj = Math.round(lng / CELL);
  const delayMin = 30 + Math.floor(Math.random() * 90);
  await q(
    `INSERT INTO incidents(cell, geom, kind, occurred_at, visible_after)
     VALUES ($1, ST_SetSRID(ST_MakePoint($3,$2),4326)::geography, $4, date_trunc('hour', now()), now() + ($5 || ' minutes')::interval)`,
    [`${ci}:${cj}`, ci * CELL, cj * CELL, kind, String(delayMin)]);
}

export async function incidentCells(lat: number, lng: number, radius = 3000) {
  return q<{ lat: number; lng: number; n: number }>(
    `SELECT ST_Y(geom::geometry) lat, ST_X(geom::geometry) lng, count(*)::int n FROM incidents
     WHERE visible_after < now() AND occurred_at > now() - interval '30 days'
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $3) GROUP BY geom`, [lat, lng, radius]);
}
