import { NextResponse } from "next/server";
import { z } from "zod";
import { turn } from "@/lib/agent";
import { currentDevice } from "@/lib/device";

export const maxDuration = 30;
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
    return NextResponse.json(await turn(sessionId, device, input));
  } catch (e) {
    console.error("turn failed", e);
    return NextResponse.json({ error: "turn failed" }, { status: 500 });
  }
}
