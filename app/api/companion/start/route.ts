import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { EXERCISES } from "@/lib/exercises";
import { personaFor } from "@/lib/personas";
import { playbookText } from "@/lib/playbooks";

const COND: Record<string, string> = { panic: "panic attacks", ocd: "OCD and intrusive thoughts", gad: "constant worry", social: "social anxiety", overwhelm: "stress and overwhelm", other: "anxiety" };

const opening = (mode: string, name: string) => {
  const hey = name ? `Hey ${name}.` : "Hey.";
  if (mode === "intrusive") return `${hey} I'm here. That thought is loud right now, and you don't have to answer it. Let's just take a slow breath together.`;
  if (mode === "overwhelm") return `${hey} I'm right here. It's a lot, and we're going to take it one small thing at a time. Put your hands down for a second, and feel your feet on the floor.`;
  if (mode === "talk") return `${hey} I'm here. Tell me what's going on. Or if you'd rather not talk, we can just breathe together.`;
  return `${hey} I'm here, and I'm not going anywhere. We're going to slow this down together. Put both feet flat on the floor for me. That's it.`;
};

// Gives the browser a signed URL for the ElevenLabs conversational agent, plus what the agent should know about THIS person.
export async function GET(req: Request) {
  const u = new URL(req.url), sessionId = u.searchParams.get("session") ?? "", mode = u.searchParams.get("mode") ?? "panic";
  const device = await currentDevice();
  const key = process.env.ELEVENLABS_API_KEY, agent = process.env.ELEVENLABS_AGENT_ID;
  if (!device || !key || !agent) return NextResponse.json({ error: "companion not configured" }, { status: 503 });
  const [s] = await q<any>("SELECT ctx FROM sessions WHERE id=$1 AND device_id=$2", [sessionId, device]);
  if (!s) return NextResponse.json({ error: "no session" }, { status: 404 });

  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent}`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return NextResponse.json({ error: "could not reach the voice service" }, { status: 502 });
  const { signed_url } = await r.json();

  const [p] = await q<any>("SELECT display_name, conditions FROM profiles WHERE device_id=$1", [device]);
  const [pr] = await q<any>("SELECT prefers, companion_voice_id, voice_id FROM preferences WHERE device_id=$1", [device]);
  const themes = await q<{ t: string }>("SELECT t FROM diary_entries, unnest(themes) t WHERE device_id=$1 GROUP BY t ORDER BY count(*) DESC LIMIT 3", [device]);
  const fav = pr?.prefers?.favorite_exercise ? EXERCISES.find((e) => e.id === pr.prefers.favorite_exercise)?.title : "";
  const name = p?.display_name ?? "";
  const persona = personaFor(p?.conditions);
  const playbook = await playbookText(p?.conditions);
  const [last] = await q<{ summary: string | null }>("SELECT summary FROM conversations WHERE device_id=$1 AND summary IS NOT NULL ORDER BY started_at DESC LIMIT 1", [device]).catch(() => []);
  return NextResponse.json({
    signedUrl: signed_url, voiceId: pr?.companion_voice_id ?? pr?.voice_id ?? null,
    vars: {
      user_name: name || "friend", conditions: (p?.conditions ?? []).map((c: string) => COND[c] ?? c).join(", ") || "not shared",
      where: s.ctx?.where ?? "not shared", what_helped: fav || "not known yet", hard_times: pr?.prefers?.hard_times ?? "not shared",
      diary_themes: themes.map((t) => t.t).join(", ") || "none yet", mode, conversation_style: persona.style, never_do: persona.avoid, playbook: playbook || "no research notes yet", situation: s.ctx?.said ? String(s.ctx.said).slice(0, 600) : "not shared yet", last_conversation: last?.summary ?? "none yet", opening_line: s.ctx?.said && s.ctx?.empathy ? `${name ? `Hey ${name}.` : "Hey."} Thank you for telling me. ${s.ctx.empathy} I'm right here, and we'll take this one step at a time.` : opening(mode, name),
    },
  });
}
