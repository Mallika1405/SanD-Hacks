import { NextResponse } from "next/server";
import { rawRoutes, scoreRoutes } from "@/lib/routing";
import type { LL } from "@/lib/sim";

export const maxDuration = 60;
const ll = (s: string | null): LL | null => { const p = (s ?? "").split(",").map(Number); return p.length === 2 && p.every(isFinite) ? [p[0], p[1]] : null; };

export async function GET(req: Request) {
  const u = new URL(req.url), from = ll(u.searchParams.get("from")), to = ll(u.searchParams.get("to"));
  if (!from || !to) return NextResponse.json({ error: "from,to required" }, { status: 400 });
  if (u.searchParams.get("mode") === "drive") {
    const r = await rawRoutes(from, to, "drive");
    return NextResponse.json({ routes: [r[0]], explanation: "" });
  }
  return NextResponse.json(await scoreRoutes(from, to));
}
