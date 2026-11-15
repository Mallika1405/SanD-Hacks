/** Best-effort street address for a point. Never blocks the alert for long and never throws. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address|route&key=${key}`, { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      const a = j.results?.[0]?.formatted_address as string | undefined;
      if (a) return a.replace(/, (USA|United States)$/, "").replace(/ \d{5}(-\d{4})?/, "");
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${lat}&lon=${lng}`, { headers: { "User-Agent": "haven-hackathon-app" }, signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    const ad = j.address ?? {};
    const street = [ad.house_number, ad.road].filter(Boolean).join(" ");
    return street || j.name || null;
  } catch { return null; }
}
