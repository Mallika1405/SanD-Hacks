import { q } from "./db";
import { dist, LL } from "./sim";

export type Route = {
  coords: LL[]; distance_m: number; duration_s: number; lit_pct: number; open_nearby: number; incidents: number;
  score: number; chosen?: boolean; segments: { coords: LL[]; lit: boolean }[];
};

function decodePoly(str: string): LL[] {
  let i = 0, lat = 0, lng = 0; const out: LL[] = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, s = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

export async function rawRoutes(from: LL, to: LL, mode: "walk" | "drive"): Promise<{ coords: LL[]; distance_m: number; duration_s: number }[]> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (key) {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${from}&destination=${to}&mode=${mode === "walk" ? "walking" : "driving"}&alternatives=true&key=${key}`, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (j.routes?.length) return j.routes.map((x: any) => ({
        coords: decodePoly(x.overview_polyline.points), distance_m: x.legs[0].distance.value, duration_s: x.legs[0].duration.value }));
    } catch {}
  }
  const base = mode === "walk" ? "https://routing.openstreetmap.de/routed-foot" : "https://routing.openstreetmap.de/routed-car";
  try {
    const r = await fetch(`${base}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&alternatives=true`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    if (j.routes?.length) return j.routes.map((x: any) => ({ coords: x.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as LL), distance_m: x.distance, duration_s: x.duration }));
  } catch {}
  return [{ coords: [from, to], distance_m: dist(from, to), duration_s: dist(from, to) / 1.3 }];
}

type Way = { lit: boolean; pts: LL[] };
async function litWays(all: LL[]): Promise<Way[] | null> {
  const lats = all.map((p) => p[0]), lngs = all.map((p) => p[1]), pad = 0.0004;
  const bbox = `${Math.min(...lats) - pad},${Math.min(...lngs) - pad},${Math.max(...lats) + pad},${Math.max(...lngs) + pad}`;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(12000),
      body: "data=" + encodeURIComponent(`[out:json][timeout:15];way["highway"]["lit"](${bbox});out geom tags;`) });
    const j = await r.json();
    return (j.elements ?? []).map((e: any) => ({ lit: !["no", "disused"].includes(e.tags.lit), pts: (e.geometry ?? []).map((g: any) => [g.lat, g.lon] as LL) }));
  } catch { return null; }
}

function segDist(p: LL, a: LL, b: LL) {
  const k = Math.cos((p[0] * Math.PI) / 180), x = (q: LL) => [(q[1] - p[1]) * 111320 * k, (q[0] - p[0]) * 111320];
  const [ax, ay] = x(a), [bx, by] = x(b), dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function sample(coords: LL[], step = 30): LL[] {
  const out: LL[] = [coords[0]]; let acc = 0;
  for (let i = 1; i < coords.length; i++) { acc += dist(coords[i - 1], coords[i]); if (acc >= step) { out.push(coords[i]); acc = 0; } }
  if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1]);
  return out;
}

export async function scoreRoutes(from: LL, to: LL) {
  const raw = await rawRoutes(from, to, "walk");
  const shortest = Math.min(...raw.map((r) => r.distance_m));
  const ways = await litWays(raw.flatMap((r) => r.coords));
  const routes: Route[] = [];
  for (const r of raw) {
    const pts = sample(r.coords);
    const flags = pts.map((p) => {
      if (!ways) return false;
      for (const w of ways) for (let i = 1; i < w.pts.length; i++) if (segDist(p, w.pts[i - 1], w.pts[i]) < 22) return w.lit;
      return false;
    });
    const segments: Route["segments"] = [];
    pts.forEach((p, i) => {
      if (i === 0) return;
      const lit = flags[i], last = segments[segments.length - 1];
      if (last && last.lit === lit) last.coords.push(p); else segments.push({ lit, coords: [pts[i - 1], p] });
    });
    const litPct = flags.length ? flags.filter(Boolean).length / flags.length : 0;
    const wkt = `LINESTRING(${r.coords.filter((_, i) => i % 3 === 0 || i === r.coords.length - 1).map((c) => `${c[1]} ${c[0]}`).join(",")})`;
    let open = 0, inc = 0;
    try {
      const [o] = await q<{ n: number }>(`SELECT count(*)::int n FROM places p LEFT JOIN LATERAL (SELECT * FROM place_facts WHERE place_id=p.id ORDER BY checked_at DESC LIMIT 1) f ON true
        WHERE ST_DWithin(p.geom, ST_GeogFromText($1), 120) AND (f.open_24h OR f.staffed)`, ["SRID=4326;" + wkt]);
      const [i2] = await q<{ n: number }>(`SELECT count(*)::int n FROM incidents WHERE visible_after<now() AND occurred_at > now() - interval '30 days' AND ST_DWithin(geom, ST_GeogFromText($1), 150)`, ["SRID=4326;" + wkt]);
      open = o.n; inc = i2.n;
    } catch {}
    const score = 0.5 * litPct + 0.3 * Math.min(open / 4, 1) - 0.4 * Math.min(inc / 3, 1) - 0.1 * (r.distance_m / shortest - 1);
    routes.push({ coords: r.coords, distance_m: Math.round(r.distance_m), duration_s: Math.round(r.duration_s), lit_pct: Math.round(litPct * 100), open_nearby: open, incidents: inc, score, segments });
  }
  const ok = routes.filter((r) => r.distance_m <= shortest * 1.25);
  const best = (ok.length ? ok : routes).reduce((a, b) => (b.score > a.score ? b : a));
  best.chosen = true;
  const extra = Math.round((best.distance_m / shortest - 1) * 100);
  const parts = [`I picked the route that's about ${best.lit_pct}% lit`];
  if (best.open_nearby) parts.push(`with ${best.open_nearby} places along it that may be open`);
  if (best.incidents === 0 && routes.some((r) => r.incidents > 0)) parts.push("and fewer recent reports");
  const explanation = `${parts.join(" ")}${extra > 0 ? `, only ${extra}% longer` : ", and it's also the shortest"}. Lighting and hours data may be incomplete.`;
  return { routes, explanation };
}
