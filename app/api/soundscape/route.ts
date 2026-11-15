import { q } from "@/lib/db";

// Calming soundscapes generated with ElevenLabs Sound Effects, then cached in Neon so each is generated only once.
const SCENES: Record<string, string> = {
  rain: "Soft steady rain falling on a cedar shingle roof, calm and cozy, no thunder, seamless loop",
  ocean: "Slow gentle ocean waves rolling onto a quiet beach, soft and rhythmic, seamless loop",
  forest: "A quiet forest at dawn, soft wind through leaves, a few distant gentle birds, peaceful, seamless loop",
  hum: "A warm, low, steady ambient drone, soft and soothing, no melody, no percussion, seamless loop",
};

export async function GET(req: Request) {
  const scene = new URL(req.url).searchParams.get("scene") ?? "";
  const prompt = SCENES[scene];
  if (!prompt) return new Response("unknown scene", { status: 400 });
  const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" };
  const [hit] = await q<{ audio: Buffer }>("SELECT audio FROM soundscapes WHERE key=$1", [scene]);
  if (hit) return new Response(new Uint8Array(hit.audio), { headers });
  if (!process.env.ELEVENLABS_API_KEY) return new Response("not configured", { status: 503 });
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: prompt, duration_seconds: 20, prompt_influence: 0.45, loop: true }), signal: AbortSignal.timeout(45000),
  }).catch(() => null);
  if (!r || !r.ok) return new Response(r?.status === 401 || r?.status === 403 ? "needs the Sound Effects permission on the ElevenLabs key" : "generation failed", { status: 503 });
  const buf = Buffer.from(await r.arrayBuffer());
  await q("INSERT INTO soundscapes(key, prompt, audio) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING", [scene, prompt, buf]);
  return new Response(new Uint8Array(buf), { headers });
}
