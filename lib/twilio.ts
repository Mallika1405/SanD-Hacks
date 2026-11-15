import twilio from "twilio";

/** Haven must never call or text emergency services. Blocks 911/112/999 and similar in any format. */
export function isEmergencyNumber(raw: string) {
  const d = (raw || "").replace(/\D/g, "");
  return /^(1?911|112|999|000|110|119|933)$/.test(d) || /^(1)?(911)$/.test(d);
}

export const baseUrl = () =>
  (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

export const twilioEnabled = () =>
  !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );

let _client: ReturnType<typeof twilio> | null = null;
export function client() {
  if (!_client)
    _client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  return _client;
}

export const VoiceResponse = twilio.twiml.VoiceResponse;

/** Validate X-Twilio-Signature against the public URL. */
export function verifyTwilio(req: Request, params: Record<string, string>): boolean {
  if (process.env.SKIP_TWILIO_VALIDATION === "1") return true;
  const sig = req.headers.get("x-twilio-signature");
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sig || !token) return false;
  const u = new URL(req.url);
  const url = baseUrl() + u.pathname + u.search;
  return twilio.validateRequest(token, sig, url, params);
}

export async function sendSms(to: string, body: string) {
  if (isEmergencyNumber(to)) throw new Error("Refusing to message an emergency number");
  if (!twilioEnabled()) {
    console.log(`[dry-run sms] ${to}: ${body}`);
    return;
  }
  await client().messages.create({ to, from: process.env.TWILIO_FROM_NUMBER!, body });
}

export function twiml(vr: InstanceType<typeof VoiceResponse>) {
  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}

export async function formParams(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => (out[k] = String(v)));
  return out;
}
