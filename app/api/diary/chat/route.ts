import { NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/gemini";
import { assessSafety } from "@/lib/safety";
import { out } from "@/lib/speech";
import { ensureDevice } from "@/lib/device";
import { q } from "@/lib/db";
import { personaFor, WRITING_CARE } from "@/lib/personas";
import { playbookText } from "@/lib/playbooks";

export const maxDuration = 30;
const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) })).min(1).max(60),
  opening: z.boolean().optional(),
});
const BAD = /(calm down|don'?t worry|you'?re fine|everything will be|i promise|i understand exactly)/i;

/** One turn of the conversational diary: reads what they said, answers like a warm friend, asks one gentle follow-up. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const device = await ensureDevice();
  const msgs = p.data.messages;
  const last = msgs[msgs.length - 1];

  if (last.role === "user") {
    const level = await assessSafety(last.text);
    if (level === "crisis" || level === "medical") {
      const reply = level === "medical"
        ? "I'm glad you told me. Chest pain, trouble breathing or feeling faint can be serious and I can't tell what's causing it. If it's new, severe or different from usual, please call 911 now."
        : "I'm really glad you told me that. You deserve support right now, from a real person. You can call or text 988 any time, and if you're in danger, call 911. I'm still here with you too.";
      return NextResponse.json({ reply, say: out([{ text: reply, pause_ms: 0 }]), crisis: level === "medical" ? "medical" : "self_harm" });
    }
  }

  const [prof] = await q<any>("SELECT display_name, conditions FROM profiles WHERE device_id=$1", [device]).catch(() => []);
  const persona = personaFor(prof?.conditions);
  const playbook = await playbookText(prof?.conditions, 1100);
  const themes = await q<any>("SELECT t AS name FROM diary_entries, unnest(themes) t WHERE device_id=$1 GROUP BY t ORDER BY count(*) DESC LIMIT 4", [device]).catch(() => []);
  const convo = msgs.map((m) => `${m.role === "user" ? "Them" : "You"}: ${m.text}`).join("\n");
  const g = await gemini<{ reply: string }>(
    p.data.opening
      ? `Start a diary conversation. Say hello in one or two short sentences, then ask this one question in your own warm words: "${persona.diaryOpen}". Reply JSON {"reply":"..."}`
      : `Conversation so far:\n${convo}\n\nWrite your next reply. Reply JSON {"reply":"..."}`,
    true,
    {
      timeoutMs: 15000,
      system: `You are the voice diary on Anchor, a calm companion for people dealing with anxiety, panic, intrusive thoughts and overwhelm. This is a real, flowing conversation, like talking to a kind, perceptive friend who is also good at helping people process things. The person is talking or typing about their day or their feelings; what they say becomes a private diary entry.
Person: ${prof?.display_name ?? "unknown name"}${prof?.conditions?.length ? `, working through: ${prof.conditions.join(", ")}` : ""}. ${themes.length ? `Themes from earlier entries: ${themes.map((t: any) => t.name).join(", ")}.` : ""}
How you reply:
- Respond to the specific things they actually said, using their own details. Reflect what you heard in plain words, then ask ONE gentle, open follow-up question that helps them go a little deeper (what it was like, what it meant, what they needed, what happened next). Never more than one question.
- 2 to 4 short sentences. Contractions, plain words, no lists, no headings, no jargon.
- If they sound distressed, validate first. If it helps, offer one small, concrete thing they could try (a slow breath with a long exhale, writing the worry down, a short walk, texting someone they trust), framed as an offer, not an order.
- If they mention going to therapy or a hard session, ask how it went or what they want to bring up next time.
- If their words suggest hopelessness, feeling like a burden, or not wanting to be here, gently say you're glad they said it, and that talking to their therapist or calling or texting 988 can help. Never dismiss it.
- Never diagnose, never promise outcomes, never say "calm down", "don't worry" or "you're fine", never give medical advice, never tell them to change medication.
- Tone for this person: ${persona.style} Never: ${persona.avoid}.
- Research notes for this person (from trusted health sites and peer-reviewed studies). Let them quietly shape your reply; never recite them: ${playbook || "none yet"}
- ${WRITING_CARE}
- If they say they're done, say a warm closing line and remind them they can save the entry.`,
    });
  let reply = String(g?.reply ?? "").trim().slice(0, 600);
  if (!reply || BAD.test(reply)) reply = "I'm here, and I'm listening. Tell me a bit more about that.";
  return NextResponse.json({ reply, say: out([{ text: reply, pause_ms: 0 }]), crisis: null });
}
