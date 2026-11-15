import { briefingAudio, signText, verifyText } from "@/lib/tts";

// Signed text-to-speech audio for Twilio <Play>. Only text we signed ourselves can be spoken.
export async function GET(req: Request) {
  const u = new URL(req.url), t = u.searchParams.get("t") ?? "", sig = u.searchParams.get("s") ?? "";
  let text = "";
  try { text = Buffer.from(t, "base64url").toString("utf8"); } catch {}
  if (!text || text.length > 600 || !verifyText(text, sig)) return new Response("forbidden", { status: 403 });
  const audio = await briefingAudio("t:" + signText(text), text);
  if (!audio) return new Response("unavailable", { status: 503 });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" } });
}
