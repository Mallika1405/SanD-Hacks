import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";

export const maxDuration = 60;
const MAX = 12 * 1024 * 1024;

// "A voice you trust": instant voice clone from a short recording. Requires explicit consent, saved with a timestamp.
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

  // one clone per device: replace any previous one
  const [prev] = await q<{ clone_voice_id: string | null }>("SELECT clone_voice_id FROM preferences WHERE device_id=$1", [device]);
  if (prev?.clone_voice_id) await fetch(`https://api.elevenlabs.io/v1/voices/${prev.clone_voice_id}`, { method: "DELETE", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }).catch(() => {});

  const fd = new FormData();
  fd.append("name", `somewhere-${device.slice(0, 8)}-${name}`);
  fd.append("description", "Instant clone created with the speaker's consent for Somewhere.");
  fd.append("remove_background_noise", "true");
  fd.append("files", file, (file as File).name || "voice.webm");
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, body: fd, signal: AbortSignal.timeout(50000) }).catch(() => null);
  if (!r || !r.ok) {
    console.error("clone failed", r?.status, r ? (await r.text()).slice(0, 300) : "");
    return NextResponse.json({ error: "I couldn't create that voice. Try a clearer, longer recording." }, { status: 502 });
  }
  const { voice_id } = await r.json();
  await q(
    `INSERT INTO preferences(device_id, voice_id, voice_kind, voice_name, voice_consent_at, clone_voice_id, clone_name, clone_consent_at) VALUES ($1,$2,'clone',$3,now(),$2,$3,now())
     ON CONFLICT (device_id) DO UPDATE SET voice_id=$2, voice_kind='clone', voice_name=$3, voice_consent_at=now(), clone_voice_id=$2, clone_name=$3, clone_consent_at=now(), updated_at=now()`,
    [device, voice_id, name]);
  return NextResponse.json({ ok: true, name });
}

// Delete the cloned voice (at ElevenLabs too) and fall back to the default preset.
export async function DELETE() {
  const device = await ensureDevice();
  const [p] = await q<{ clone_voice_id: string | null }>("SELECT clone_voice_id FROM preferences WHERE device_id=$1", [device]);
  if (p?.clone_voice_id && process.env.ELEVENLABS_API_KEY) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${p.clone_voice_id}`, { method: "DELETE", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }).catch(() => null);
    if (!r || !(r.ok || r.status === 404)) return NextResponse.json({ error: "Couldn't delete the voice. Please try again." }, { status: 502 });
  }
  await q(`UPDATE preferences SET clone_voice_id=NULL, clone_name=NULL, clone_consent_at=NULL,
    voice_id=CASE WHEN voice_kind='clone' THEN NULL ELSE voice_id END, voice_name=CASE WHEN voice_kind='clone' THEN NULL ELSE voice_name END,
    voice_consent_at=NULL, voice_kind=CASE WHEN voice_kind='clone' THEN 'preset' ELSE voice_kind END WHERE device_id=$1`, [device]);
  return NextResponse.json({ ok: true });
}
