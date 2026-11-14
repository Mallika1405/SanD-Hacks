import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { gemini } from "@/lib/gemini";

type Chips = { clothing?: string; height?: string; direction?: string; time_place?: string };

const rule = (t: string): Chips => {
  const c: Chips = {};
  const cl = t.match(/\b(wearing|in a|in an)\s+([^.,;]{3,40})/i); if (cl) c.clothing = cl[2];
  const h = t.match(/\b(tall|short|about \d['’]\s?\d*|\d feet)[^.,;]{0,20}/i); if (h) c.height = h[0];
  const d = t.match(/\b(heading|going|walking|behind me|toward|towards|north|south|east|west)[^.,;]{0,30}/i); if (d) c.direction = d[0];
  return c;
};

// Extract description chips from a transcript. Gemini if available, simple rules otherwise. Optional persistence.
export async function POST(req: Request) {
  const { sessionId, transcript, place } = await req.json().catch(() => ({}));
  if (!transcript || typeof transcript !== "string") return NextResponse.json({ chips: {} });
  const g = await gemini<Chips>(
    `From this transcript of a person describing someone following them, extract only facts she actually stated. JSON {"clothing": string|null, "height": string|null, "direction": string|null, "time_place": string|null}. Use null if not stated. Do not invent.\nPlace context: ${place ?? "unknown"}\nTime now: ${new Date().toLocaleTimeString()}\n\n${transcript.slice(-4000)}`);
  const chips: Chips = g ? Object.fromEntries(Object.entries(g).filter(([, v]) => v)) : rule(transcript);
  if (!chips.time_place && place) chips.time_place = `${new Date().toLocaleTimeString()} · ${place}`;
  if (sessionId) {
    const [s] = await q<{ persisted: boolean }>("SELECT persisted FROM sessions WHERE id=$1", [sessionId]);
    if (s?.persisted) await q(`INSERT INTO descriptions(session_id,chips) VALUES ($1,$2) ON CONFLICT (session_id) DO UPDATE SET chips=descriptions.chips || EXCLUDED.chips, updated_at=now()`, [sessionId, JSON.stringify(chips)]);
  }
  return NextResponse.json({ chips });
}
