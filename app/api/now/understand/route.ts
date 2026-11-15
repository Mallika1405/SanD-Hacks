import { NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/gemini";
import { assessSafety, rulesLevel } from "@/lib/safety";

export const maxDuration = 20;
const Body = z.object({ text: z.string().min(3).max(1200) });

/** Reads what someone says is going on, checks safety first, and picks the kind of help that fits. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Tell me a little more." }, { status: 400 });
  const t = p.data.text.trim();
  const level = rulesLevel(t) !== "none" ? rulesLevel(t) : await assessSafety(t);
  if (level === "crisis") return NextResponse.json({ crisis: "self_harm" });
  if (level === "medical") return NextResponse.json({ crisis: "medical" });
  const g = await gemini<{ flow: string; empathy: string }>(`What they said:\n"""${t}"""\n\nReply JSON {"flow": "panic"|"intrusive"|"overwhelm"|"talk", "empathy": "..."}`, true, {
    timeoutMs: 9000,
    system: `You read what a person says they're going through and choose the kind of help that fits best.
flow: "panic" = panic, a racing heart, fear in the body right now. "intrusive" = unwanted thoughts, urges to check, wash, or seek reassurance, OCD-type loops. "overwhelm" = too much at once, stress, burnout, can't cope. "talk" = they mainly want to talk or it's unclear.
empathy: ONE short sentence in second person that reflects what they said in their own details, warm and plain (for example "That sounds exhausting, with everything landing at once."). Never diagnose, never promise it will stop, never say "calm down" or "don't worry", no question.`,
  });
  const flow = ["panic", "intrusive", "overwhelm", "talk"].includes(String(g?.flow)) ? String(g!.flow) : "talk";
  const empathy = String(g?.empathy ?? "").replace(/\?/g, ".").slice(0, 200);
  return NextResponse.json({ flow, empathy });
}
