import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { handleDigit } from "@/lib/alerts";

// Vapi server messages: tool calls (claim_alert) and call status updates.
export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-vapi-secret") !== secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => null);
  const m = body?.message;
  if (!m) return NextResponse.json({});
  const vapiCallId: string | undefined = m.call?.id ?? m.callId;
  const rowFor = async () => {
    const meta = m.call?.metadata?.callRowId;
    if (meta) return meta as string;
    const [r] = await q<{ id: string }>("SELECT id FROM alert_calls WHERE call_sid=$1", [vapiCallId]);
    return r?.id;
  };

  if (m.type === "tool-calls" || m.type === "function-call") {
    const raw = m.toolCallList ?? m.toolCalls ?? (m.functionCall ? [{ id: m.functionCall.id ?? "1", name: m.functionCall.name }] : []);
    // Vapi sends either {id, name} or {id, function: {name}}
    const list = raw.map((t: any) => ({ id: t.id, name: t.name ?? t.function?.name }));
    const rowId = await rowFor();
    const results = [];
    for (const t of list) {
      let result = "Sorry, something went wrong.";
      if (t.name === "claim_alert" && rowId) result = (await handleDigit(rowId, "1")).message;
      results.push({ toolCallId: t.id, result });
    }
    return NextResponse.json({ results });
  }

  if (m.type === "end-of-call-report" && vapiCallId) {
    await q("UPDATE alert_calls SET status=CASE WHEN status IN ('initiated','ringing','in-progress','queued') THEN 'completed' ELSE status END, updated_at=now() WHERE call_sid=$1", [vapiCallId]);
    return NextResponse.json({});
  }

  if (m.type === "status-update" && vapiCallId) {
    const map: Record<string, string> = { queued: "queued", ringing: "ringing", "in-progress": "in-progress", ended: "completed" };
    const st = map[m.status];
    if (st) {
      const control = m.call?.monitor?.controlUrl;
      await q("UPDATE alert_calls SET status=$2, control_url=COALESCE($3, control_url), updated_at=now() WHERE call_sid=$1", [vapiCallId, st, control ?? null]);
    }
  }
  return NextResponse.json({});
}
