import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { listSourced, researchTechniques, slug } from "@/lib/techniques";
import { brightEnabled } from "@/lib/brightdata";
import { BY_FLOW, getExercise } from "@/lib/exercises";

export const maxDuration = 30;
const Body = z.object({ sessionId: z.string().uuid(), situation: z.string().min(2).max(100) });

/** Called by the companion as a tool: look up techniques on trusted health sites for this person's situation (Bright Data + Gemini), grounded in Neon. */
export async function POST(req: Request) {
  const device = await currentDevice();
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!device || !p.success) return NextResponse.json({ text: "I couldn't look that up. Use slow breathing and grounding." });
  const [s] = await q<any>("SELECT flow, ctx FROM sessions WHERE id=$1 AND device_id=$2", [p.data.sessionId, device]);
  if (!s) return NextResponse.json({ text: "I couldn't look that up. Use slow breathing and grounding." });

  // Intrusive thoughts / OCD: reviewed techniques only (web advice often leans on reassurance, which can feed the loop).
  if (s.flow === "intrusive" || /ocd|intrusive|compuls|checking|what if/i.test(p.data.situation)) {
    const ids = BY_FLOW.intrusive.slice(0, 3);
    return NextResponse.json({ text: "For intrusive thoughts use ONLY these reviewed ideas, and never reassure about the thought: " + ids.map((id) => { const e = getExercise(id); return `${e.title}: ${e.segments.slice(0, 5).map((x) => x.text.replace(/<[^>]+>/g, "")).join(" ")}`; }).join(" || ") });
  }
  const flow = s.flow === "overwhelm" ? "overwhelm" : "panic";
  const where = s.ctx?.where ? ` ${s.ctx.where}` : "";
  const sit = p.data.situation.toLowerCase().includes(where.trim()) ? p.data.situation.toLowerCase() : `${p.data.situation.toLowerCase()}${where}`;
  const key = `${flow}:${slug(sit)}`;
  await q("UPDATE sessions SET research_key=$2, research='pending' WHERE id=$1", [p.data.sessionId, key]);
  if (brightEnabled()) await Promise.race([researchTechniques(key, flow, sit, p.data.sessionId), new Promise((r) => setTimeout(r, 11000))]);
  const found = await listSourced(key);
  if (!found.length) return NextResponse.json({ text: "Nothing specific came back yet. Use slow breathing with a long exhale and the 5-4-3-2-1 grounding." });
  const text = "Techniques from trusted health sites (not reviewed by a clinician). Say them in your own warm words, one step at a time: " +
    found.slice(0, 2).map((t) => `${t.title} (from ${t.source_name}): ${t.segments.slice(1).map((x) => x.text).join(" ")}`).join(" || ");
  return NextResponse.json({ text: text.slice(0, 1800) });
}
