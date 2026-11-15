import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// Turns coordinates into a city name for the search. Coordinates are used for this one lookup and are not stored.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ city: null }, { status: 400 });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${p.data.lat}&lon=${p.data.lng}`, { headers: { "User-Agent": "somewhere-demo" }, signal: AbortSignal.timeout(6000) });
    const a = (await r.json()).address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.county;
    return NextResponse.json({ city: city ? `${city}${a.state ? ", " + a.state : ""}` : null });
  } catch { return NextResponse.json({ city: null }); }
}
