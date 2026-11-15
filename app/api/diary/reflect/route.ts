import { NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/gemini";
import { assessSafety } from "@/lib/safety";
import { out } from "@/lib/speech";

const Body = z.object({ text: z.string().min(3).max(1500), silent: z.boolean().optional() });
const BAD = /(don'?t worry|you'?re fine|calm down|everything will|i promise|you should|you need to|try to|i understand|\?)/i;

/** One short line that reflects back what she just said. No advice, no questions, no reassurance. Safety first. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const level = await assessSafety(p.data.text);
  if (level === "crisis" || level === "medical") return NextResponse.json({ crisis: level === "medical" ? "medical" : "self_harm" });
  if (p.data.silent) return NextResponse.json({ say: [] }); // safety check only
  const g = await gemini<{ say: string }>(`They just said: """${p.data.text.slice(-900)}"""`, true, {
    system: `You are quietly listening to someone talk freely in a voice diary. Write ONE short sentence (max 18 words) that reflects back the feeling or the thing they just said, in your own warm words, starting with something like "It sounds like" or "That sounds". No advice. No questions. No reassurance. Never "I understand". Reply JSON {"say":"..."}`, timeoutMs: 4500 });
  const say = g?.say?.trim();
  if (!say || BAD.test(say) || say.split(/\s+/).length > 26) return NextResponse.json({ say: [] });
  return NextResponse.json({ say: out([{ text: say, pause_ms: 0 }]) });
}
