import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { gemini } from "@/lib/gemini";

// A gentle, hedged observation across her own saved entries. Never a diagnosis, never advice beyond "you might bring this to a therapist".
export async function POST() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ text: null });
  const rows = await q<any>("SELECT created_at, title, summary, feelings, themes, intensity FROM diary_entries WHERE device_id=$1 ORDER BY created_at DESC LIMIT 8", [device]);
  if (rows.length < 3) return NextResponse.json({ text: "A few more entries and I can start to notice patterns with you." });
  const brief = rows.map((r) => `${new Date(r.created_at).toDateString()} | intensity ${r.intensity ?? "?"} | feelings ${r.feelings.join(",")} | themes ${r.themes.join(",")} | ${r.summary}`).join("\n");
  const g = await gemini<{ text: string }>(`Diary entries (newest first):\n${brief}`, true, {
    system: `You gently notice patterns across a person's own diary entries. Write at most 3 short sentences. Use hedged wording ("you might notice", "it seems"). Mention only patterns that clearly appear in the entries (recurring themes, feelings, times, or how intensity changed). No diagnosis, no advice, no reassurance. You may end with "This could be worth sharing with a therapist if you have one." Reply JSON {"text":"..."}`, timeoutMs: 12000 });
  return NextResponse.json({ text: g?.text?.trim().slice(0, 500) ?? null });
}
