import { NextResponse } from "next/server";
import { refreshArea } from "@/lib/safehaven";

export const maxDuration = 300;
const UCSD = { lat: 32.8801, lng: -117.234 };

function authed(req: Request) {
  if (process.env.HAVEN_DEV === "1") return true;
  return !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}
async function run(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat") ?? UCSD.lat), lng = Number(u.searchParams.get("lng") ?? UCSD.lng);
  return NextResponse.json(await refreshArea(lat, lng, Number(u.searchParams.get("radius") ?? 1800), 16));
}
export const GET = run;
export const POST = run;
