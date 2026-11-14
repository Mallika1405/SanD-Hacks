import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";

const Body = z.object({ lines: z.array(z.object({ role: z.enum(["user", "agent"]), text: z.string().max(2000), t: z.number().optional() })).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  const [s] = await q<{ persisted: boolean }>("SELECT persisted FROM sessions WHERE id=$1 AND status='active'", [id]);
  if (!s?.persisted) return NextResponse.json({ error: "not persisting" }, { status: 409 });
  for (const l of p.data.lines)
    await q("INSERT INTO transcripts(session_id,role,text,created_at) VALUES ($1,$2,$3, to_timestamp($4))", [id, l.role, l.text, (l.t ?? Date.now()) / 1000]);
  return NextResponse.json({ ok: true });
}
