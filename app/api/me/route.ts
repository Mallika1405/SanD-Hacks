import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { EXERCISES } from "@/lib/exercises";

const title = (id: string) => EXERCISES.find((e) => e.id === id)?.title ?? id;

export async function GET() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ sessions: [], prefs: null, saved: { providers: [], groups: [] }, checkin: null });
  const sessions = await q<any>("SELECT id, flow, started_at, ended_at, helpful_exercise_ids, ctx->'tried' AS tried FROM sessions WHERE device_id=$1 ORDER BY started_at DESC LIMIT 30", [device]);
  const [prefs] = await q<any>("SELECT voice_kind, voice_name, voice_consent_at, clone_name, clone_consent_at, prefers, checkins_opt_in FROM preferences WHERE device_id=$1", [device]);
  const providers = await q<any>("SELECT p.id, p.name, p.source_url FROM provider_matches m JOIN providers p ON p.id=m.provider_id WHERE m.device_id=$1 ORDER BY m.created_at DESC", [device]);
  const groups = await q<any>("SELECT g.id, g.name, g.source_url FROM provider_matches m JOIN groups g ON g.id=m.group_id WHERE m.device_id=$1 ORDER BY m.created_at DESC", [device]);
  const [checkin] = await q<any>("SELECT due_at FROM checkins WHERE device_id=$1 AND done_at IS NULL ORDER BY due_at LIMIT 1", [device]);
  return NextResponse.json({
    sessions: sessions.map((s: any) => ({ ...s, helpful: (s.helpful_exercise_ids ?? []).map(title), tried: (s.tried ?? []).map(title) })),
    prefs: prefs ? { ...prefs, favorite: prefs.prefers?.favorite_exercise ? title(prefs.prefers.favorite_exercise) : null, hard_times: prefs.prefers?.hard_times ?? null } : null,
    saved: { providers, groups }, checkin: checkin ?? null,
  });
}

// "Forget what helps": clears remembered preferences but keeps the chosen voice.
export async function PATCH() {
  const device = await currentDevice();
  if (device) await q("UPDATE preferences SET prefers='{}', updated_at=now() WHERE device_id=$1", [device]);
  return NextResponse.json({ ok: true });
}

// Delete everything: sessions, preferences, check-ins, saved lists, and the cloned voice at ElevenLabs.
export async function DELETE() {
  const device = await currentDevice();
  let voiceDeleted = true;
  if (device) {
    const [p] = await q<{ clone_voice_id: string | null }>("SELECT clone_voice_id FROM preferences WHERE device_id=$1", [device]);
    if (p?.clone_voice_id && process.env.ELEVENLABS_API_KEY) {
      const r = await fetch(`https://api.elevenlabs.io/v1/voices/${p.clone_voice_id}`, { method: "DELETE", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }).catch(() => null);
      voiceDeleted = !!r && (r.ok || r.status === 404);
    }
    if (voiceDeleted) await q("DELETE FROM devices WHERE id=$1", [device]); // cascades to everything
  }
  if (voiceDeleted) (await cookies()).delete("sw_device");
  return NextResponse.json({ ok: voiceDeleted, voiceDeleted });
}
