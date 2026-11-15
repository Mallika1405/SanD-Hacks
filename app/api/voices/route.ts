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
  const [p] = await q<any>("SELECT voice_id, voice_kind, voice_name, clone_voice_id, clone_name, clone_consent_at, companion_voice_id, diary_voice_id, soothing FROM preferences WHERE device_id=$1", [device]);
  const clones = await q<any>("SELECT voice_id, name, consent_at FROM cloned_voices WHERE device_id=$1 ORDER BY consent_at", [device]);
  return NextResponse.json({
    presets: PRESETS, clones,
    assigned: { guide: p?.voice_id ?? DEFAULT_VOICE, companion: p?.companion_voice_id ?? p?.voice_id ?? DEFAULT_VOICE, diary: p?.diary_voice_id ?? p?.voice_id ?? DEFAULT_VOICE },
    soothing: !!p?.soothing,
    selected: p?.voice_id ? { id: p.voice_id, kind: p.voice_kind, name: p.voice_name } : { id: DEFAULT_VOICE, kind: "preset", name: PRESETS[0].name },
    clone: { available: await cloningAvailable() },
    sample: { text: SAMPLE_LINE, sig: sign(SAMPLE_LINE) },
  });
}

const Body = z.object({
  voice_id: z.string().optional(),
  target: z.enum(["all", "companion", "guide", "diary"]).default("all"), soothing: z.boolean().optional(),
});
const COL = { guide: "voice_id", companion: "companion_voice_id", diary: "diary_voice_id" } as const;
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  await q("INSERT INTO preferences(device_id) VALUES ($1) ON CONFLICT (device_id) DO NOTHING", [device]);
  if (p.data.soothing !== undefined) { await q("UPDATE preferences SET soothing=$2, updated_at=now() WHERE device_id=$1", [device, p.data.soothing]); if (!p.data.voice_id) return NextResponse.json({ ok: true }); }
  let id: string, name: string, kind: "preset" | "clone";
  const preset = PRESETS.find((x) => x.id === p.data.voice_id);
  if (preset) { id = preset.id; name = preset.name; kind = "preset"; }
  else {
    const [c] = await q<any>("SELECT voice_id, name FROM cloned_voices WHERE device_id=$1 AND voice_id=$2", [device, p.data.voice_id ?? ""]);
    if (!c) return NextResponse.json({ error: "unknown voice" }, { status: 400 });
    id = c.voice_id; name = c.name; kind = "clone";
  }
  const targets = p.data.target === "all" ? (["guide", "companion", "diary"] as const) : ([p.data.target] as const);
  for (const t of targets) {
    await q(`UPDATE preferences SET ${COL[t]}=$2, updated_at=now() WHERE device_id=$1`, [device, id]);
    if (t === "guide") await q("UPDATE preferences SET voice_kind=$2, voice_name=$3 WHERE device_id=$1", [device, kind, name]);
  }
  return NextResponse.json({ ok: true });
}
