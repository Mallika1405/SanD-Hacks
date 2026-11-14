import { q } from "./db";
import { gemini } from "./gemini";
import { brightEnabled, serp, unlock } from "./brightdata";

type Cand = { external_id: string; name: string; category: string; address?: string; website?: string; lat: number; lng: number; hours?: string; source: string };

const GOOGLE_TYPES = ["pharmacy", "hospital", "police", "convenience_store", "gas_station", "supermarket", "cafe"];
const STAFFED_CATS = ["hospital", "police", "pharmacy", "fire_station", "convenience", "convenience_store", "fuel", "gas_station", "supermarket"];

async function googleCandidates(lat: number, lng: number, radius: number): Promise<Cand[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.location,places.primaryType,places.regularOpeningHours.weekdayDescriptions,places.googleMapsUri",
    },
    body: JSON.stringify({ includedTypes: GOOGLE_TYPES, maxResultCount: 20, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("places " + r.status);
  const j = await r.json();
  return (j.places ?? []).map((p: any) => ({
    external_id: "g:" + p.id, name: p.displayName?.text ?? "Place", category: p.primaryType ?? "place", address: p.formattedAddress,
    website: p.websiteUri, lat: p.location.latitude, lng: p.location.longitude,
    hours: p.regularOpeningHours?.weekdayDescriptions?.join("; "), source: p.googleMapsUri ?? "https://maps.google.com",
  }));
}

async function overpassCandidates(lat: number, lng: number, radius: number): Promise<Cand[]> {
  const around = `(around:${radius},${lat},${lng})`;
  const ql = `[out:json][timeout:25];(nwr${around}[amenity~"^(pharmacy|hospital|police|fire_station|cafe|fast_food|fuel)$"];nwr${around}[shop~"^(convenience|supermarket)$"];);out center tags 60;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(ql), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("overpass " + r.status);
  const j = await r.json();
  return (j.elements ?? []).filter((e: any) => e.tags?.name).map((e: any) => ({
    external_id: `osm:${e.type}/${e.id}`, name: e.tags.name, category: e.tags.amenity ?? e.tags.shop ?? "place",
    address: [e.tags["addr:housenumber"], e.tags["addr:street"]].filter(Boolean).join(" ") || undefined, website: e.tags.website,
    lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, hours: e.tags.opening_hours, source: `https://www.openstreetmap.org/${e.type}/${e.id}`,
  })).filter((c: Cand) => c.lat && c.lng);
}

export async function fetchCandidates(lat: number, lng: number, radius: number) {
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) {
    try { const c = await googleCandidates(lat, lng, radius); if (c.length) return c; } catch (e) { console.error(e); }
  }
  return overpassCandidates(lat, lng, radius);
}

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fetch venue page / SERP via Bright Data and extract hours with Gemini. */
async function webFacts(c: Cand) {
  if (!brightEnabled()) return null;
  try {
    const text = c.website ? await unlock(c.website) : await serp(`${c.name} ${c.address ?? ""} opening hours`);
    const out = await gemini<{ hours_text: string | null; open_24h: boolean; staffed: boolean | null; confidence: number }>(
      `Extract the business hours for "${c.name}" from this page text. Reply JSON {"hours_text": string|null (concise weekly hours), "open_24h": boolean, "staffed": boolean|null (is it staffed by people at the stated hours), "confidence": number 0-1}. If hours are not clearly stated use null and low confidence. Do not guess.\n\nTEXT:\n${text}`);
    return out ? { ...out, source_url: c.website ?? `https://www.google.com/search?q=${encodeURIComponent(c.name + " hours")}` } : null;
  } catch (e) { console.error("webFacts", c.name, e); return null; }
}

export async function refreshPlace(c: Cand) {
  const [p] = await q<{ id: string }>(
    `INSERT INTO places(external_id,name,category,address,website,geom) VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($7,$6),4326)::geography)
     ON CONFLICT (external_id) DO UPDATE SET name=EXCLUDED.name, website=COALESCE(EXCLUDED.website, places.website) RETURNING id`,
    [c.external_id, c.name, c.category, c.address ?? null, c.website ?? null, c.lat, c.lng]);
  const w = await webFacts(c);
  const baseOpen24 = /24\s*\/\s*7|24 hours|open 24/i.test(c.hours ?? "");
  let hours = c.hours ?? null, open24 = baseOpen24, source = c.source, conf = c.hours ? 0.55 : 0.3, uncertain = false;
  let staffed: boolean | null = STAFFED_CATS.includes(c.category) ? true : null;
  if (w) {
    if (c.hours && w.hours_text && norm(c.hours) !== norm(w.hours_text) && w.open_24h === baseOpen24 && !/24/.test(w.hours_text)) uncertain = true;
    if (c.hours && w.open_24h !== baseOpen24) uncertain = true;
    hours = w.hours_text ?? hours; open24 = w.open_24h || open24; source = w.source_url; conf = uncertain ? Math.min(0.4, w.confidence) : Math.max(w.confidence, conf);
    if (w.staffed != null) staffed = w.staffed;
  }
  await q("INSERT INTO place_facts(place_id,source_url,hours_text,open_24h,staffed,confidence,uncertain) VALUES ($1,$2,$3,$4,$5,$6,$7)", [p.id, source, hours, open24, staffed, conf, uncertain]);
}

export async function refreshArea(lat: number, lng: number, radius = 1500, maxStale = 12) {
  const cands = await fetchCandidates(lat, lng, radius);
  const fresh = await q<{ external_id: string }>(
    "SELECT p.external_id FROM places p JOIN place_facts f ON f.place_id=p.id WHERE f.checked_at > now() - interval '12 hours'");
  const skip = new Set(fresh.map((r) => r.external_id));
  const todo = cands.filter((c) => !skip.has(c.external_id)).slice(0, maxStale);
  for (let i = 0; i < todo.length; i += 4) await Promise.allSettled(todo.slice(i, i + 4).map(refreshPlace));
  return { candidates: cands.length, refreshed: todo.length };
}

function likelyOpenNow(hours: string | null, open24: boolean, now = new Date()): "open_24h" | "may_be_open" | "may_be_closed" | "unknown" {
  if (open24) return "open_24h";
  if (!hours) return "unknown";
  const mins = now.getHours() * 60 + now.getMinutes();
  const ranges = [...hours.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–\-—to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)];
  if (!ranges.length) return "unknown";
  const conv = (h: string, m: string, ap?: string) => { let x = +h; if (ap) { x = x % 12 + (/pm/i.test(ap) ? 12 : 0); } return x * 60 + +m; };
  for (const r of ranges) {
    const a = conv(r[1], r[2], r[3] ?? r[6]), b = conv(r[4], r[5], r[6] ?? r[3]);
    if (b > a ? mins >= a && mins <= b : mins >= a || mins <= b) return "may_be_open";
  }
  return "may_be_closed";
}

export type SafePlace = {
  id: string; name: string; category: string; address: string | null; lat: number; lng: number; distance_m: number;
  source_url: string | null; checked_at: string | null; minutes_ago: number | null; hours_text: string | null;
  status: string; uncertain: boolean; staffed: boolean | null; score: number; hedge: string;
};

/** Cache-only read. Never calls any external service. */
export async function safePlaces(lat: number, lng: number, radius = 1200, limit = 5, category?: string): Promise<SafePlace[]> {
  const rows = await q<any>(
    `SELECT p.id,p.name,p.category,p.address, ST_Y(p.geom::geometry) lat, ST_X(p.geom::geometry) lng,
       ST_Distance(p.geom, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography) dist_m,
       f.source_url,f.checked_at,f.hours_text,f.open_24h,f.staffed,f.confidence,f.uncertain
     FROM places p LEFT JOIN LATERAL (SELECT * FROM place_facts WHERE place_id=p.id ORDER BY checked_at DESC LIMIT 1) f ON true
     WHERE ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $3) ${category ? "AND p.category=$4" : ""}`,
    category ? [lat, lng, radius, category] : [lat, lng, radius]);
  const now = Date.now();
  const out: SafePlace[] = rows.map((r) => {
    const status = likelyOpenNow(r.hours_text, r.open_24h);
    const ageH = r.checked_at ? (now - new Date(r.checked_at).getTime()) / 3.6e6 : 999;
    const staffedScore = r.open_24h || r.staffed === true || ["hospital", "police"].includes(r.category) ? 1 : status === "may_be_open" ? 0.7 : status === "unknown" ? 0.25 : 0;
    const score = 0.45 * (1 - Math.min(1, r.dist_m / radius)) + 0.4 * staffedScore + 0.15 * (ageH < 24 ? 1 : ageH < 168 ? 0.5 : 0) - (r.uncertain ? 0.15 : 0);
    return {
      id: r.id, name: r.name, category: r.category, address: r.address, lat: r.lat, lng: r.lng, distance_m: Math.round(r.dist_m),
      source_url: r.source_url, checked_at: r.checked_at, minutes_ago: r.checked_at ? Math.round((now - new Date(r.checked_at).getTime()) / 60000) : null,
      hours_text: r.hours_text, status, uncertain: !!r.uncertain, staffed: r.staffed, score,
      hedge: r.uncertain ? "Sources disagree on hours. Treat as uncertain." : "Hours may have changed. This is a likely option, not a guarantee.",
    };
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
