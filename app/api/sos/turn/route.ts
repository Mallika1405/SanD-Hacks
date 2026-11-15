import { after, NextResponse } from "next/server";
import { z } from "zod";
import { turn } from "@/lib/agent";
import { currentDevice } from "@/lib/device";
import { q } from "@/lib/db";
import { researchTechniques } from "@/lib/techniques";

export const maxDuration = 60;
const Body = z.object({
  sessionId: z.string().uuid(),
  event: z.enum(["start", "segments_done", "okay_now", "resume", "help_now", "safe_now"]).optional(),
  text: z.string().max(1000).optional(),
  spoken_idx: z.number().int().min(-1).max(60).optional(),
  interrupted: z.boolean().optional(),
});

export async function POST(req: Request) {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ error: "no device" }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const { sessionId, ...input } = p.data;
    const res = await turn(sessionId, device, input);
    if (res.research) {
      // Bright Data research runs in the background so her first seconds are never slowed.
      const r = res.research;
      await q("UPDATE sessions SET research_key=$2, research='pending' WHERE id=$1", [sessionId, r.key]);
      after(() => researchTechniques(r.key, r.flow, r.sit, sessionId));
    }
    return NextResponse.json(res);
  } catch (e) {
    console.error("turn failed", e);
    return NextResponse.json({ error: "turn failed" }, { status: 500 });
  }
}
