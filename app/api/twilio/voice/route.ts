import { q } from "@/lib/db";
import { briefing, Alert } from "@/lib/alerts";
import { speak } from "@/lib/tts";
import { formParams, verifyTwilio, twiml, VoiceResponse, baseUrl } from "@/lib/twilio";

export async function POST(req: Request) {
  const params = await formParams(req);
  if (!verifyTwilio(req, params)) return new Response("forbidden", { status: 403 });
  const callId = new URL(req.url).searchParams.get("callId")!;
  const vr = new VoiceResponse();
  const b = baseUrl();
  const [row] = await q<any>(
    `SELECT ac.id, a.id AS alert_id, c.name AS claimer FROM alert_calls ac
     JOIN alerts a ON a.id=ac.alert_id LEFT JOIN contacts c ON c.id=a.claimed_by WHERE ac.id=$1`, [callId]);
  if (!row) { await speak(vr, "Sorry, something went wrong.", b); vr.hangup(); return twiml(vr); }
  const [alert] = await q<Alert>("SELECT * FROM alerts WHERE id=$1", [row.alert_id]);
  if (alert.status === "claimed") await speak(vr, `${row.claimer} is responding. You do not need to do anything else.`, b);
  else if (alert.status === "cancelled") await speak(vr, "The sender cancelled this alert. No action needed.", b);
  else {
    const g = vr.gather({ numDigits: 1, timeout: 8, action: `${b}/api/twilio/gather?callId=${callId}`, method: "POST" });
    const text = await briefing(alert);
    await speak(g, text, b);
    g.pause({ length: 1 });
    await speak(g, text, b);
    await speak(vr, "No response received. Goodbye.", b);
  }
  vr.hangup();
  return twiml(vr);
}
