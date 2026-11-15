import { NextResponse } from "next/server";
import { z } from "zod";
import { assessSafety } from "@/lib/safety";

const Body = z.object({ text: z.string().min(1).max(1500) });
// Checks what she says during the live conversation. The conversation itself is never allowed to override this.
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ level: "none" });
  return NextResponse.json({ level: await assessSafety(p.data.text) });
}
