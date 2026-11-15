import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

export const maxDuration = 60;
const MAX = 12 * 1024 * 1024;

// "Voices you trust": instant voice clones (up to 5) from a short recording. Requires explicit consent, saved with a timestamp.
export async function POST(req: Request) {
  const device = await ensureDevice();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const consent = form.get("consent") === "true";
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const file = form.get("file");
  if (!consent) return NextResponse.json({ error: "Consent is required." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Please say whose voice this is." }, { status: 400 });
  if (!(file instanceof Blob) || file.size < 2000 || file.size > MAX) return NextResponse.json({ error: "Please upload a recording under 12 MB." }, { status: 400 });
  if (!process.env.ELEVENLABS_API_KEY) return NextResponse.json({ error: "Voice cloning isn't configured." }, { status: 503 });

  const [cnt] = await q<{ n: number }>("SELECT count(*)::int n FROM cloned_voices WHERE device_id=$1", [device]);
  if ((cnt?.n ?? 0) >= 5) return NextResponse.json({ error: "You can keep up to 5 voices. Delete one to add another." }, { status: 400 });

  const fd = new FormData();
  fd.append("name", `somewhere-${device.slice(0, 8)}-${name}`);
  fd.append("description", "Instant clone created with the speaker's consent for Anchor.");
  fd.append("remove_background_noise", "true");
  fd.append("files", file, (file as File).name || "voice.webm");
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, body: fd, signal: AbortSignal.timeout(50000) }).catch(() => null);
  if (!r || !r.ok) {
    const body = r ? (await r.text()).slice(0, 300) : "";
    console.error("clone failed", r?.status, body);
    if (r?.status === 401 && /voices_write|missing_permissions/.test(body)) return NextResponse.json({ error: "Your ElevenLabs API key doesn't have permission to create voices. In ElevenLabs, open the key's settings, turn on Voices: Write, save, and try again." }, { status: 502 });
    return NextResponse.json({ error: "I couldn't create that voice. Try a clearer, longer recording." }, { status: 502 });
  }
  const { voice_id } = await r.json();
  await q("INSERT INTO cloned_voices(device_id, voice_id, name) VALUES ($1,$2,$3)", [device, voice_id, name]);
  return NextResponse.json({ ok: true, name, voice_id });
}

// Delete one cloned voice (at ElevenLabs too). Anything that used it falls back to the default.
export async function DELETE(req: Request) {
  const device = await ensureDevice();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const [c] = await q<{ voice_id: string }>("SELECT voice_id FROM cloned_voices WHERE device_id=$1 AND voice_id=$2", [device, id]);
  if (!c) return NextResponse.json({ error: "Voice not found." }, { status: 404 });
  if (process.env.ELEVENLABS_API_KEY) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${c.voice_id}`, { method: "DELETE", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }).catch(() => null);
    if (!r || !(r.ok || r.status === 404)) return NextResponse.json({ error: "Couldn't delete the voice. Please try again." }, { status: 502 });
  }
  await q("DELETE FROM cloned_voices WHERE device_id=$1 AND voice_id=$2", [device, c.voice_id]);
  await q(`UPDATE preferences SET
    voice_kind=CASE WHEN voice_id=$2 THEN 'preset' ELSE voice_kind END, voice_name=CASE WHEN voice_id=$2 THEN NULL ELSE voice_name END,
    voice_id=NULLIF(voice_id,$2), companion_voice_id=NULLIF(companion_voice_id,$2), diary_voice_id=NULLIF(diary_voice_id,$2) WHERE device_id=$1`, [device, c.voice_id]);
  return NextResponse.json({ ok: true });
}
