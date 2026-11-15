// Vapi outbound calls with an ElevenLabs voice. The callee confirms by voice ("I'm responding"); the assistant
// calls our claim_alert tool, which runs the same atomic claim as the Twilio path.
import { baseUrl } from "./twilio";

export const vapiEnabled = () => !!(process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID);

const API = "https://api.vapi.ai";
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${process.env.VAPI_API_KEY}` });

export async function createVapiCall(opts: { to: string; callRowId: string; contactName: string; userName: string; where: string }) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const first = `Hi ${opts.contactName}. This is Haven, a safety app. ${opts.userName} just asked her emergency contacts for help${opts.where}. She may need someone. Can you respond? Please say "I'm responding" if you can help.`;
  const r = await fetch(`${API}/call`, {
    method: "POST", headers: hdr(), signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: opts.to, name: opts.contactName },
      metadata: { callRowId: opts.callRowId },
      assistant: {
        firstMessage: first,
        firstMessageMode: "assistant-speaks-first",
        maxDurationSeconds: 120,
        silenceTimeoutSeconds: 25,
        endCallFunctionEnabled: true,
        voice: { provider: "11labs", voiceId, model: "eleven_flash_v2_5" },
        model: {
          provider: "openai", model: "gpt-4o-mini", temperature: 0.2,
          messages: [{ role: "system", content:
            "You are an automated safety-alert caller for the Haven app. You already told the person that their friend asked for help. " +
            "If they say they are responding, yes, on my way, or press/say one, call the claim_alert tool, then say exactly what the tool returns in one short sentence and end the call. " +
            "If they say no or can't help, say thanks and end the call. Never claim to be emergency services. Never invent details. Keep every reply under 15 words. " +
            "If they ask what is happening, say their friend asked her emergency contacts for help and a link with her live location was sent, and ask again if they can respond. If they say they are responding, call the tool immediately." }],
          tools: [{
            type: "function",
            function: { name: "claim_alert", description: "Call when the person confirms they are responding to the alert.", parameters: { type: "object", properties: {} } },
            server: { url: `${baseUrl()}/api/vapi/webhook`, ...(process.env.VAPI_WEBHOOK_SECRET ? { secret: process.env.VAPI_WEBHOOK_SECRET } : {}) },
          }],
        },
        server: { url: `${baseUrl()}/api/vapi/webhook`, ...(process.env.VAPI_WEBHOOK_SECRET ? { secret: process.env.VAPI_WEBHOOK_SECRET } : {}) },
        serverMessages: ["status-update", "end-of-call-report"],
      },
    }),
  });
  if (!r.ok) throw new Error(`vapi ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { id: j.id as string, controlUrl: (j.monitor?.controlUrl as string) ?? null };
}

/** Speak a message on a live call, then hang up. */
export async function vapiSayAndEnd(controlUrl: string, message: string) {
  await fetch(controlUrl, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ type: "say", content: message, endCallAfterSpoken: true }) });
}
export async function vapiEnd(controlUrl: string) {
  await fetch(controlUrl, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ type: "end-call" }) });
}
