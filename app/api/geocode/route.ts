import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams.get("q");
  if (!qs) return NextResponse.json({ results: [] });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=4&q=${encodeURIComponent(qs)}`, { headers: { "User-Agent": "haven-hackathon-app" }, signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    return NextResponse.json({ results: j.map((x: any) => ({ name: x.display_name.split(",").slice(0, 2).join(","), lat: +x.lat, lng: +x.lon })) });
  } catch { return NextResponse.json({ results: [] }); }
}
