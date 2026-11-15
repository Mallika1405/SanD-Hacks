import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { gemini } from "@/lib/gemini";

export const maxDuration = 30;
type Prep = { bring: string[]; wins: string[]; struggles: string[]; questions: string[] };
const arr = (v: any, n: number) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, n) : []);

/** A "what to bring to your next session" summary from HER OWN logs. She chooses whether to copy or share it. */
export async function POST() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ error: "no profile" }, { status: 400 });
  const since = "now() - interval '14 days'";
  const urges = await q<any>(`SELECT data FROM tracker_logs WHERE device_id=$1 AND kind='ocd_urge' AND created_at > ${since}`, [device]);
  const panic = await q<any>(`SELECT data FROM tracker_logs WHERE device_id=$1 AND kind='panic_episode' AND created_at > ${since}`, [device]);
  const daily = await q<any>(`SELECT data FROM tracker_logs WHERE device_id=$1 AND kind='daily' AND created_at > ${since}`, [device]);
  const diary = await q<any>("SELECT created_at, title, summary, feelings, themes, intensity, risk FROM diary_entries WHERE device_id=$1 ORDER BY created_at DESC LIMIT 4", [device]);
  const hw = await q<any>("SELECT title, done_at FROM therapy_homework WHERE device_id=$1 ORDER BY created_at DESC LIMIT 8", [device]);
  const [plan] = await q<any>("SELECT therapist_name, modality FROM therapy_plans WHERE device_id=$1", [device]);

  const facts: string[] = [];
  if (urges.length) { const u = urges.map((x) => x.data); facts.push(`Urges logged: ${u.length}. Did it ${u.filter((x: any) => x.response === "did").length}, delayed ${u.filter((x: any) => x.response === "delayed").length}, resisted ${u.filter((x: any) => x.response === "resisted").length}.`); }
  if (panic.length) facts.push(`Panic episodes: ${panic.length}, average ${Math.round(panic.reduce((a, x) => a + (x.data.minutes ?? 0), 0) / panic.length)} minutes.`);
  if (daily.length) facts.push(`Daily checks: ${daily.length}, average anxiety ${(daily.reduce((a, x) => a + (x.data.anxiety ?? 0), 0) / daily.length).toFixed(1)}/10.`);
  if (hw.length) facts.push(`Homework: ${hw.filter((h) => h.done_at).length} of ${hw.length} done.`);
  const entries = diary.map((d) => `${new Date(d.created_at).toDateString()} (intensity ${d.intensity ?? "?"}): ${d.summary}`);

  const g = await gemini<Prep>(`Facts from the last two weeks, self-reported:\n${facts.join("\n") || "none logged"}\nDiary:\n${entries.join("\n") || "none"}\nTherapy: ${plan?.modality ?? "not set"}`, true, {
    system: `You help a person prepare for their next therapy session using only their own logs. Write in second person, warm, plain, hedged ("it looks like"). No diagnosis, no advice beyond what to bring up. Reply JSON {"bring": [3 to 5 short things worth raising], "wins": [up to 3 real things that went better, only if the data shows it], "struggles": [up to 3 honest hard spots], "questions": [up to 3 questions they could ask their therapist]}.`, timeoutMs: 15000 });
  const prep: Prep = g ? { bring: arr(g.bring, 5), wins: arr(g.wins, 3), struggles: arr(g.struggles, 3), questions: arr(g.questions, 3) } : { bring: facts.slice(0, 4), wins: [], struggles: [], questions: [] };
  const share = [
    `Summary from my own logs (self-reported, made with Somewhere), last 14 days${plan?.therapist_name ? ` — for ${plan.therapist_name}` : ""}:`,
    ...facts.map((f) => `- ${f}`),
    ...(prep.wins.length ? ["What went better:", ...prep.wins.map((x) => `- ${x}`)] : []),
    ...(prep.struggles.length ? ["What's been hard:", ...prep.struggles.map((x) => `- ${x}`)] : []),
    ...(prep.questions.length ? ["Questions I'd like to ask:", ...prep.questions.map((x) => `- ${x}`)] : []),
  ].join("\n");
  return NextResponse.json({ ...prep, share });
}
