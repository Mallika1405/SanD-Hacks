import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { logEvent } from "@/lib/alerts";

const Body = z.object({
  userId: z.string().uuid().optional(),
  mode: z.enum(["walk", "ride", "party", "emergency"]).default("walk"),
  destination: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).nullish(),
  expectedRoute: z.array(z.tuple([z.number(), z.number()])).nullish(),
});

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  let userId = p.data.userId;
  if (!userId) {
    const [u] = await q<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1");
    if (!u) return NextResponse.json({ error: "No user. Run npm run seed." }, { status: 400 });
    userId = u.id;
  }
  // one active session at a time
  await q("UPDATE sessions SET status='ended', ended_at=now() WHERE user_id=$1 AND status='active'", [userId]);
  const [s] = await q<any>(
    "INSERT INTO sessions(user_id, mode, destination, expected_route) VALUES ($1,$2,$3,$4) RETURNING id, mode, destination, expected_route, started_at",
    [userId, p.data.mode, p.data.destination ? JSON.stringify(p.data.destination) : null, p.data.expectedRoute ? JSON.stringify(p.data.expectedRoute) : null]);
  await logEvent(null, s.id, "session_start", `${p.data.mode} session started`);
  return NextResponse.json(s);
}
