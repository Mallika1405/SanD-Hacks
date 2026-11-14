import { after, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { createAlert, maybeRetry, responderLink } from "@/lib/alerts";

export const maxDuration = 120;

const Body = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().uuid().nullish(),
  reason: z.string().max(300).optional(),
  placeText: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  let userId = parsed.data.userId;
  if (!userId) {
    const [u] = await q<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1");
    if (!u) return NextResponse.json({ error: "No user. Run npm run seed." }, { status: 400 });
    userId = u.id;
  }
  const alert = await createAlert({ ...parsed.data, userId });
  // Retry after 60s (also triggered lazily by polling /api/alerts/[token]).
  after(async () => {
    await new Promise((r) => setTimeout(r, 62_000));
    await maybeRetry(alert.id).catch(() => {});
  });
  return NextResponse.json({
    id: alert.id, token: alert.token, ownerSecret: alert.owner_secret, link: responderLink(alert),
  });
}
