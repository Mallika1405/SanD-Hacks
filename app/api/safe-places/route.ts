import { NextResponse } from "next/server";
import { safePlaces } from "@/lib/safehaven";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng)) return NextResponse.json({ error: "lat,lng required" }, { status: 400 });
  const radius = Math.min(5000, Number(u.searchParams.get("radius") ?? 1200));
  const cat = u.searchParams.get("category") ?? undefined;
  try {
    return NextResponse.json({ places: await safePlaces(lat, lng, radius, Number(u.searchParams.get("limit") ?? 5), cat) });
  } catch (e) {
    return NextResponse.json({ places: [], error: "unavailable" });
  }
}
