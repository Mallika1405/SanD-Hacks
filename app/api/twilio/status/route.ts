import { q } from "@/lib/db";
import { formParams, verifyTwilio } from "@/lib/twilio";

export async function POST(req: Request) {
  const params = await formParams(req);
  if (!verifyTwilio(req, params)) return new Response("forbidden", { status: 403 });
  const callId = new URL(req.url).searchParams.get("callId")!;
  const key = req.headers.get("i-twilio-idempotency-token") || `${params.CallSid}:${params.CallStatus}`;
  const fresh = await q("INSERT INTO webhook_events(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [key + ":" + params.CallStatus]);
  if (fresh.length) {
    await q("UPDATE alert_calls SET status=$2, updated_at=now() WHERE id=$1", [callId, params.CallStatus]);
  }
  return new Response("ok");
}
