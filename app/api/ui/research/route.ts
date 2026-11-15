import { NextResponse } from "next/server";
import { researchUi } from "@/lib/uiResearch";

export const maxDuration = 300;
async function run(req: Request) {
  const ok = (process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) || process.env.NODE_ENV !== "production";
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const conds = (new URL(req.url).searchParams.get("c") ?? "ocd,panic,gad,social,overwhelm").split(",");
  const out = [];
  for (const c of conds) out.push(await researchUi(c.trim()));
  return NextResponse.json(out);
}
export const GET = run; export const POST = run;
