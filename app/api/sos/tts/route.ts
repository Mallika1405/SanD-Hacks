import { currentDevice } from "@/lib/device";
import { q } from "@/lib/db";
import { PRESETS, TTS_MODEL, TTS_SETTINGS, TTS_SETTINGS_SOOTHING } from "@/lib/voices";
import { sign, verify } from "@/lib/speech";

const cache = new Map<string, Buffer>();

/** Streams ElevenLabs speech. Only text this server signed can be spoken, so no voice (including a cloned one) can say arbitrary text. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const t = u.searchParams.get("t") ?? "", s = u.searchParams.get("s") ?? "", v = u.searchParams.get("v") ?? "";
  let text = "";
  try { text = Buffer.from(t, "base64url").toString("utf8"); } catch {}
  if (!text || text.length > 700 || !verify(text, s)) return new Response("forbidden", { status: 403 });
  let allowed = PRESETS.some((p) => p.id === v), soothing = false;
  const dev = await currentDevice();
  if (dev) {
    const [r] = await q<any>("SELECT voice_id, clone_voice_id, companion_voice_id, diary_voice_id, soothing FROM preferences WHERE device_id=$1", [dev]);
    soothing = !!r?.soothing;
    if (!allowed && /^[A-Za-z0-9]{10,40}$/.test(v)) {
      const own = await q<{ voice_id: string }>("SELECT voice_id FROM cloned_voices WHERE device_id=$1", [dev]);
      allowed = own.some((c) => c.voice_id === v) || [r?.voice_id, r?.clone_voice_id, r?.companion_voice_id, r?.diary_voice_id].includes(v);
    }
  }
  if (!allowed) return new Response("voice not allowed", { status: 403 });
  if (!process.env.ELEVENLABS_API_KEY) return new Response("tts not configured", { status: 503 });

  const key = `${v}:${soothing ? "s" : "n"}:${sign(text)}`;
  const hit = cache.get(key);
  const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" };
  if (hit) return new Response(new Uint8Array(hit), { headers });

  const up = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: soothing ? TTS_SETTINGS_SOOTHING : TTS_SETTINGS }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!up || !up.ok || !up.body) return new Response("tts failed", { status: 502 });
  const [a, b] = up.body.tee();
  (async () => {
    const chunks: Uint8Array[] = []; const rd = b.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; if (value) chunks.push(value); }
    if (cache.size > 300) cache.clear();
    cache.set(key, Buffer.concat(chunks));
  })().catch(() => {});
  return new Response(a, { headers });
}
