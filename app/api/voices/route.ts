import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";
import { DEFAULT_VOICE, PRESETS, SAMPLE_LINE } from "@/lib/voices";
import { sign } from "@/lib/speech";

let cloneOk: { v: boolean; t: number } | null = null;
async function cloningAvailable() {
  if (cloneOk && Date.now() - cloneOk.t < 600_000) return cloneOk.v;
  let v = false;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" }, signal: AbortSignal.timeout(5000) });
    v = r.ok && (await r.json()).can_use_instant_voice_cloning === true;
  } catch {}
  cloneOk = { v, t: Date.now() };
  return v;
}

export async function GET() {
  const device = await ensureDevice();
  const [p] = await q<any>("SELECT voice_id, voice_kind, voice_name, clone_voice_id, clone_name, clone_consent_at FROM preferences WHERE device_id=$1", [device]);
  return NextResponse.json({
    presets: PRESETS,
    selected: p?.voice_id ? { id: p.voice_id, kind: p.voice_kind, name: p.voice_name } : { id: DEFAULT_VOICE, kind: "preset", name: PRESETS[0].name },
    clone: { available: await cloningAvailable(), existing: p?.clone_voice_id ? { id: p.clone_voice_id, name: p.clone_name, consent_at: p.clone_consent_at } : null },
    sample: { text: SAMPLE_LINE, sig: sign(SAMPLE_LINE) },
  });
}

const Body = z.object({ voice_id: z.string().optional(), use_clone: z.boolean().optional() });
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  if (p.data.use_clone) {
    const r = await q(
      `UPDATE preferences SET voice_id=clone_voice_id, voice_kind='clone', voice_name=clone_name, updated_at=now() WHERE device_id=$1 AND clone_voice_id IS NOT NULL RETURNING device_id`, [device]);
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "no cloned voice" }, { status: 400 });
  }
  const preset = PRESETS.find((x) => x.id === p.data.voice_id);
  if (!preset) return NextResponse.json({ error: "unknown voice" }, { status: 400 });
  await q(
    `INSERT INTO preferences(device_id, voice_id, voice_kind, voice_name) VALUES ($1,$2,'preset',$3)
     ON CONFLICT (device_id) DO UPDATE SET voice_id=$2, voice_kind='preset', voice_name=$3, updated_at=now()`,
    [device, preset.id, preset.name]);
  return NextResponse.json({ ok: true });
}
