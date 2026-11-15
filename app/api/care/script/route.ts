import { NextResponse } from "next/server";
import { z } from "zod";
import { gemini } from "@/lib/gemini";

const Body = z.object({ insurance: z.string().max(80).default(""), kind: z.enum(["therapy", "groups", "psychiatry", "low_cost"]).default("therapy"), focus: z.string().max(90).default("anxiety"), budget: z.string().max(20).default("flexible"), name: z.string().max(120).optional() });

// A copy-and-paste message for reaching out. Uses only what she chose to include: no name, no history.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { insurance, kind, focus, budget, name } = p.data;
  const plan = insurance && !/^(no insurance|not sure|self-pay)$/i.test(insurance) ? `[${insurance}]` : "";
  const fallback = `Hello${name ? `, ${name}` : ""}. I'm looking for ${kind === "groups" ? "a support group" : kind === "psychiatry" ? "a psychiatric appointment" : "a therapist"} for ${focus}. Could you let me know if you have openings in the next month${plan ? `, and whether you're in-network with ${plan}` : ", and what your self-pay and sliding scale rates are"}? Thank you.`;
  const g = await gemini<{ text: string }>(
    `Write a short, polite, plain-language message (max 70 words) a person can paste into an email or leave as a voicemail to a ${kind === "groups" ? "support group organizer" : "provider's office"}. They are looking for help with ${focus}. ${plan ? `Ask whether they are in-network with ${plan}.` : "Ask about self-pay and sliding scale rates."} Ask about openings in the next month${budget !== "flexible" ? " and lower-cost options" : ""}. Do NOT include any personal story, diagnosis, name, or contact details. Reply JSON {"text":"..."}`, true, { timeoutMs: 5000 });
  return NextResponse.json({ text: g?.text && g.text.length < 600 ? g.text.trim() : fallback });
}
