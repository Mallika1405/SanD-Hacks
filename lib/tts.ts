// ElevenLabs TTS for the contact briefing. Any failure returns null so the caller falls back to Twilio <Say>.
import crypto from "crypto";

const cache = new Map<string, Buffer>();
export const ttsEnabled = () => !!process.env.ELEVENLABS_API_KEY;

export async function briefingAudio(key: string, text: string): Promise<Buffer | null> {
  if (!ttsEnabled()) return null;
  const k = key + ":" + text;
  const hit = cache.get(k);
  if (hit) return hit;
  try {
    const voice = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (cache.size > 50) cache.clear();
    cache.set(k, buf);
    return buf;
  } catch { return null; }
}

const secret = () => process.env.TWILIO_AUTH_TOKEN || process.env.CRON_SECRET || "haven";
export const signText = (t: string) => crypto.createHmac("sha256", secret()).update(t).digest("hex").slice(0, 32);
export const verifyText = (t: string, sig: string) => sig === signText(t);

/** Speak `text` on a TwiML node using the ElevenLabs voice (signed audio URL), falling back to Twilio's built-in voice. */
export async function speak(node: { play: (u: string) => unknown; say: (t: string) => unknown }, text: string, base: string) {
  const ok = await briefingAudio("t:" + signText(text), text);
  if (ok) node.play(`${base}/api/twilio/tts?t=${encodeURIComponent(Buffer.from(text).toString("base64url"))}&s=${signText(text)}`);
  else node.say(text);
}
