import { NextResponse } from "next/server";
import { brightEnabled, serp } from "@/lib/brightdata";
import { gemini } from "@/lib/gemini";

/** Best-effort live traffic/closure note for ride check-ins. Never blocks the alert path. */
export async function GET(req: Request) {
  const u = new URL(req.url), lat = u.searchParams.get("lat"), lng = u.searchParams.get("lng"), area = u.searchParams.get("area") || "San Diego";
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY, dest = u.searchParams.get("dest");
  try {
    if (key && lat && lng && dest) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lng}&destination=${dest}&departure_time=now&key=${key}`, { signal: AbortSignal.timeout(4000) });
      const j = await r.json(), leg = j.routes?.[0]?.legs?.[0];
      if (leg?.duration_in_traffic && leg.duration_in_traffic.value > leg.duration.value * 1.3)
        return NextResponse.json({ note: `Traffic is heavier than usual, about ${Math.round(leg.duration_in_traffic.value / 60)} minutes to go.` });
    }
    if (brightEnabled()) {
      const text = await serp(`road closure traffic accident ${area} today`, 5000);
      const g = await gemini<{ note: string | null }>(`From these search results, give ONE short sentence about a current road closure or major traffic incident near ${area}, or null if nothing clearly current. JSON {"note": string|null}.\n${text}`);
      if (g?.note) return NextResponse.json({ note: g.note });
    }
  } catch {}
  return NextResponse.json({ note: null });
}
