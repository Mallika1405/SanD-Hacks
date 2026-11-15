import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { ensureDevice } from "@/lib/device";
import { DEFAULT_VOICE, PRESETS, SAMPLE_LINE } from "@/lib/voices";
import { sign } from "@/lib/speech";

export async function GET() {
  const device = await ensureDevice();
  const [p] = await q<any>("SELECT voice_id, voice_kind, voice_name, voice_consent_at FROM preferences WHERE device_id=$1", [device]);
  return NextResponse.json({
    presets: PRESETS,
    selected: p?.voice_id ? { id: p.voice_id, kind: p.voice_kind, name: p.voice_name, consent_at: p.voice_consent_at } : { id: DEFAULT_VOICE, kind: "preset", name: PRESETS[0].name },
    sample: { text: SAMPLE_LINE, sig: sign(SAMPLE_LINE) },
  });
}

const Body = z.object({ voice_id: z.string() });
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  const preset = p.success ? PRESETS.find((x) => x.id === p.data.voice_id) : null;
  if (!preset) return NextResponse.json({ error: "unknown voice" }, { status: 400 });
  const device = await ensureDevice();
  await q(
    `INSERT INTO preferences(device_id, voice_id, voice_kind, voice_name, voice_consent_at) VALUES ($1,$2,'preset',$3,NULL)
     ON CONFLICT (device_id) DO UPDATE SET voice_id=$2, voice_kind='preset', voice_name=$3, voice_consent_at=NULL, updated_at=now()`,
    [device, preset.id, preset.name]);
  return NextResponse.json({ ok: true });
}
