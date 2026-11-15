import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { gemini } from "@/lib/gemini";

export const maxDuration = 30;

async function saving(device: string) {
  const [p] = await q<{ save_conversations: boolean }>("SELECT save_conversations FROM preferences WHERE device_id=$1", [device]);
  return p?.save_conversations ?? true;
}

// The list of saved conversations (no transcripts), the person's saving preference, or one full transcript with ?id=
export async function GET(req: Request) {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ save: true, items: [] });
  const id = new URL(req.url).searchParams.get("id");
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    const [c] = await q<any>("SELECT id, mode, started_at, summary, transcript FROM conversations WHERE id=$1 AND device_id=$2", [id, device]);
    return NextResponse.json({ conversation: c ?? null });
  }
  const items = await q<any>("SELECT id, mode, started_at, summary, jsonb_array_length(transcript) AS lines FROM conversations WHERE device_id=$1 ORDER BY started_at DESC LIMIT 20", [device]);
  return NextResponse.json({ save: await saving(device), items });
}

const Body = z.object({
  sessionId: z.string().uuid().optional(),
  transcript: z.array(z.object({ role: z.enum(["user", "agent"]), text: z.string().max(2000) })).max(400).optional(),
  mode: z.string().max(20).optional(), ended: z.boolean().optional(), save: z.boolean().optional(),
});

export async function POST(req: Request) {
  const device = await currentDevice();
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!device || !p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (p.data.save !== undefined) {
    await q("INSERT INTO preferences(device_id, save_conversations) VALUES ($1,$2) ON CONFLICT (device_id) DO UPDATE SET save_conversations=$2, updated_at=now()", [device, p.data.save]);
    return NextResponse.json({ ok: true });
  }
  if (!p.data.sessionId || !p.data.transcript?.length || !(await saving(device))) return NextResponse.json({ ok: true, skipped: true });
  const [s] = await q<any>("SELECT id FROM sessions WHERE id=$1 AND device_id=$2", [p.data.sessionId, device]);
  if (!s) return NextResponse.json({ error: "no session" }, { status: 404 });
  await q(`INSERT INTO conversations(device_id, session_id, mode, transcript) VALUES ($1,$2,$3,$4)
    ON CONFLICT (session_id) DO UPDATE SET transcript=$4, updated_at=now()`, [device, p.data.sessionId, p.data.mode ?? "talk", JSON.stringify(p.data.transcript)]);
  if (p.data.ended && p.data.transcript.filter((l) => l.role === "user").length >= 2) {
    const text = p.data.transcript.map((l) => `${l.role === "user" ? "Person" : "Juno"}: ${l.text}`).join("\n").slice(0, 9000);
    const g = await gemini<{ summary: string }>(`Conversation:\n${text}\n\nReply JSON {"summary": "..."}`, true, { timeoutMs: 12000, system: "Summarize this support conversation in 2 short sentences, second person (\"You talked about...\"), warm and plain. Name what they were going through and what helped, if said. No advice, no diagnosis." });
    if (g?.summary) await q("UPDATE conversations SET summary=$2 WHERE session_id=$1", [p.data.sessionId, String(g.summary).slice(0, 400)]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const device = await currentDevice();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!device || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await q("DELETE FROM conversations WHERE id=$1 AND device_id=$2", [id, device]);
  return NextResponse.json({ ok: true });
}
