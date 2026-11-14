import { q } from "@/lib/db";
import { briefing, Alert } from "@/lib/alerts";
import { formParams, verifyTwilio, twiml, VoiceResponse, baseUrl } from "@/lib/twilio";

export async function POST(req: Request) {
  const params = await formParams(req);
  if (!verifyTwilio(req, params)) return new Response("forbidden", { status: 403 });
  const callId = new URL(req.url).searchParams.get("callId")!;
  const vr = new VoiceResponse();
  const [row] = await q<any>(
    `SELECT ac.id, a.id AS alert_id, c.name AS claimer FROM alert_calls ac
     JOIN alerts a ON a.id=ac.alert_id LEFT JOIN contacts c ON c.id=a.claimed_by WHERE ac.id=$1`, [callId]);
  if (!row) { vr.say("Sorry, something went wrong."); vr.hangup(); return twiml(vr); }
  const [alert] = await q<Alert>("SELECT * FROM alerts WHERE id=$1", [row.alert_id]);
  if (alert.status === "claimed") vr.say(`${row.claimer} is responding. You do not need to do anything else.`);
  else if (alert.status === "cancelled") vr.say("The sender cancelled this alert. No action needed.");
  else {
    const g = vr.gather({ numDigits: 1, timeout: 8, action: `${baseUrl()}/api/twilio/gather?callId=${callId}`, method: "POST" });
    const text = await briefing(alert);
    g.say(text);
    g.pause({ length: 1 });
    g.say(text);
    vr.say("No response received. Goodbye.");
  }
  vr.hangup();
  return twiml(vr);
}
