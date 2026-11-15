import { NextResponse } from "next/server";
import { discover } from "@/lib/care";

export const maxDuration = 300;
// Protected: CRON_SECRET bearer token, or open in local dev only.
async function run(req: Request) {
  const okAuth = (process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) || process.env.NODE_ENV !== "production";
  if (!okAuth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const city = new URL(req.url).searchParams.get("city") || "San Diego, CA";
  try { return NextResponse.json(await discover(city)); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export const GET = run;
export const POST = run;
