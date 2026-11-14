import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { createAlert, logEvent } from "@/lib/alerts";
import { recordIncident } from "@/lib/incidents";
import { safePlaces } from "@/lib/safehaven";

const Body = z.object({ sessionId: z.string().uuid(), lat: z.number(), lng: z.number() });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  const { sessionId, lat, lng } = p.data;
  const [s] = await q<{ user_id: string }>("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!s) return NextResponse.json({ error: "no session" }, { status: 404 });
  await q("UPDATE sessions SET persisted=true WHERE id=$1", [sessionId]);
  await logEvent(null, sessionId, "followed", "Marked as being followed. Recording started.");
  let places: Awaited<ReturnType<typeof safePlaces>> = [];
  try { places = await safePlaces(lat, lng, 1500, 3); } catch {}
  const nearest = places[0] ?? null;
  const [alert, ] = await Promise.all([
    createAlert({ userId: s.user_id, sessionId, lat, lng, kind: "soft", reason: "followed", placeText: nearest ? `near ${nearest.name}` : undefined }),
    recordIncident(lat, lng, "followed").catch(() => {}),
  ]);
  return NextResponse.json({ nearest, places, token: alert.token, ownerSecret: alert.owner_secret });
}
