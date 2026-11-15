import { q } from "@/lib/db";
import { briefing, Alert } from "@/lib/alerts";
import { briefingAudio } from "@/lib/tts";

// Twilio <Play> fetches this. The alert id is an unguessable UUID; the audio is the neutral briefing only.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("alertId");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return new Response("bad", { status: 400 });
  const [alert] = await q<Alert>("SELECT * FROM alerts WHERE id=$1", [id]);
  if (!alert) return new Response("not found", { status: 404 });
  const audio = await briefingAudio(id, await briefing(alert));
  if (!audio) return new Response("unavailable", { status: 503 });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" } });
}
