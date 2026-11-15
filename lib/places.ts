// Google Maps Places API (New). Used for accurate coordinates and for finding real practices near a point.
const key = () => process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
export const placesEnabled = () => !!key();

export type Place = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; website: string | null; phone: string | null; rating: number | null; ratings: number | null; mapsUri: string | null; type: string | null };

export async function placesSearch(textQuery: string, opts: { lat?: number; lng?: number; radiusMi?: number; max?: number } = {}): Promise<Place[]> {
  if (!placesEnabled()) return [];
  try {
    const body: any = { textQuery, maxResultCount: opts.max ?? 10 };
    if (opts.lat != null && opts.lng != null) body.locationBias = { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: Math.min(50000, Math.max(1000, (opts.radiusMi ?? 25) * 1609)) } };
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.error("places failed", r.status, (await r.text()).slice(0, 160)); return []; }
    const j = await r.json();
    return (j.places ?? []).map((p: any) => ({ id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? null, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, website: p.websiteUri ?? null, phone: p.nationalPhoneNumber ?? null, rating: p.rating ?? null, ratings: p.userRatingCount ?? null, mapsUri: p.googleMapsUri ?? null, type: p.primaryTypeDisplayName?.text ?? null }));
  } catch (e) { console.error("places error", (e as Error).message); return []; }
}
