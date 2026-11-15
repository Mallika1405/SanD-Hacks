import { NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/gemini";
import { assessSafety } from "@/lib/safety";
import { out } from "@/lib/speech";

export const maxDuration = 30;
const Body = z.object({ transcript: z.string().min(10).max(20000) });
type Draft = { title: string; summary: string; heard: string; feelings: string[]; themes: string[]; quote: string; intensity: number };
const arr = (v: any, n: number) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase().trim().slice(0, 30)).filter(Boolean).slice(0, n) : []);

/** Turns what she said into a gentle draft entry. NOT saved: she reviews and edits it first. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Not enough to reflect on yet." }, { status: 400 });
  const t = p.data.transcript;
  const level = await assessSafety(t.slice(-3000));
  const g = await gemini<Draft>(`Voice diary transcript:\n"""${t.slice(0, 12000)}"""`, true, {
    system: `You help a person reflect after they spoke freely in a voice diary. You are NOT a chatbot and you give no advice. Write in second person ("You...") in warm, plain, non-clinical language. Never diagnose. Never promise anything. Never judge. Never invent details that were not said.
Return JSON {"title": string (max 6 words, no diagnosis), "summary": string (2 to 4 sentences: what was going on and how it felt, using their own details), "heard": string (2 to 3 sentences starting "What I heard is" that name the feelings gently, like "a lot of pressure, with tiredness underneath"), "feelings": string[] (up to 5 single lowercase feeling words), "themes": string[] (up to 4 short lowercase topics like "work" or "sleep"), "quote": string (a short phrase of max 15 words copied from the transcript, or ""), "intensity": number (1 to 10, how intense the distress seemed)}`, timeoutMs: 25000 });
  if (!g?.summary) return NextResponse.json({ error: "I couldn't put that together. Your words are still here. Try again." }, { status: 502 });
  const draft = {
    title: String(g.title ?? "A moment").slice(0, 60), summary: String(g.summary).slice(0, 700), heard: String(g.heard ?? "").slice(0, 500),
    feelings: arr(g.feelings, 5), themes: arr(g.themes, 4), quote: String(g.quote ?? "").slice(0, 160),
    intensity: Math.min(10, Math.max(1, Math.round(Number(g.intensity) || 5))),
  };
  const say = draft.heard ? out([{ text: draft.heard, pause_ms: 0 }]) : [];
  return NextResponse.json({ draft, say, crisis: level === "crisis" ? "self_harm" : level === "medical" ? "medical" : null });
}
