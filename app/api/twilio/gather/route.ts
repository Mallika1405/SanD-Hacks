import { handleDigit } from "@/lib/alerts";
import { speak } from "@/lib/tts";
import { baseUrl, formParams, verifyTwilio, twiml, VoiceResponse } from "@/lib/twilio";

export async function POST(req: Request) {
  const params = await formParams(req);
  if (!verifyTwilio(req, params)) return new Response("forbidden", { status: 403 });
  const callId = new URL(req.url).searchParams.get("callId")!;
  const vr = new VoiceResponse();
  const r = await handleDigit(callId, params.Digits ?? "");
  if (r.done) {
    await speak(vr, r.message, baseUrl());
    vr.hangup();
  } else {
    vr.redirect({ method: "POST" }, `${baseUrl()}/api/twilio/voice?callId=${callId}`);
  }
  return twiml(vr);
}
