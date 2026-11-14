import { NextResponse } from "next/server";
import { incidentCells } from "@/lib/incidents";

export async function GET(req: Request) {
  const u = new URL(req.url), lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng)) return NextResponse.json({ cells: [] });
  try { return NextResponse.json({ cells: await incidentCells(lat, lng) }); } catch { return NextResponse.json({ cells: [] }); }
}
