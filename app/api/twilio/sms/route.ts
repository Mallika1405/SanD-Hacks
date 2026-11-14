import { q } from "@/lib/db";
import { formParams, verifyTwilio } from "@/lib/twilio";

// Inbound SMS: YES opts a contact in, STOP opts out.
export async function POST(req: Request) {
  const params = await formParams(req);
  if (!verifyTwilio(req, params)) return new Response("forbidden", { status: 403 });
  const body = (params.Body ?? "").trim().toUpperCase(), from = params.From;
  const key = req.headers.get("i-twilio-idempotency-token") || params.MessageSid;
  const fresh = await q("INSERT INTO webhook_events(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", ["sms:" + key]);
  if (fresh.length && from) {
    if (/^(YES|Y|START)$/.test(body)) await q("UPDATE contacts SET opted_in_at=COALESCE(opted_in_at, now()) WHERE phone=$1", [from]);
    else if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(body)) await q("UPDATE contacts SET opted_in_at=NULL WHERE phone=$1", [from]);
  }
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
