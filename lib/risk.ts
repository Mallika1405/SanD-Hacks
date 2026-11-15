import { gemini } from "./gemini";
import { rulesLevel } from "./safety";

export type Risk = "none" | "watch" | "concerning" | "urgent";
const rank: Record<Risk, number> = { none: 0, watch: 1, concerning: 2, urgent: 3 };
const HOPELESS = /(hopeless|no point|worthless|can'?t go on|nothing matters|give up|a burden|burden to|empty inside|don'?t see a way|trapped|numb to everything|nobody would (notice|care)|can'?t do this anymore)/i;
const WATCH = /(haven'?t slept|can'?t sleep|not eating|skipping meals|isolat|cancel(l)?ed (on )?everyone|avoiding everyone|drinking more|can'?t get out of bed|stopped going)/i;

const SYSTEM = `You review ONE voice diary entry for signs that the person may need more support than a self-help app. You are not diagnosing.
Reply JSON {"risk":"none"|"watch"|"concerning"|"urgent","note":string}.
urgent = thoughts of suicide or self-harm, a plan, intent, taking pills, or a possible medical emergency.
concerning = hopelessness, feeling like a burden, being unable to function, using substances to cope, or feeling trapped.
watch = stress clearly building, poor sleep or appetite, pulling away from people, or rising panic.
none = ordinary distress or reflection.
note = ONE gentle sentence addressed to the person ("you"), no diagnosis, no alarm, suggesting what could help (for example reaching out to their therapist or someone they trust). When unsure between two levels, choose the more cautious.`;

export async function diaryRisk(text: string): Promise<{ risk: Risk; note: string | null }> {
  let risk: Risk = "none";
  const r = rulesLevel(text);
  if (r === "crisis" || r === "medical") risk = "urgent";
  else if (HOPELESS.test(text)) risk = "concerning";
  else if (WATCH.test(text)) risk = "watch";
  const g = await gemini<{ risk: Risk; note: string }>(`Diary entry:\n"""${text.slice(0, 6000)}"""`, true, { system: SYSTEM, timeoutMs: 8000 });
  const gr = g && g.risk in rank ? g.risk : "none";
  if (rank[gr] > rank[risk]) risk = gr;
  const note = risk === "none" ? null : (g?.note?.trim().slice(0, 300) ?? (risk === "urgent" ? "What you shared sounds like you need support right now." : "This sounds heavy. It might help to tell your therapist or someone you trust."));
  return { risk, note };
}

/** Trends across saved entries (newest first). Deterministic: no model involved. */
export function diarySignals(rows: { created_at: string; intensity: number | null; risk: Risk; feelings: string[] }[]) {
  const out: { level: "watch" | "concerning"; text: string; action: "therapist" | "crisis" | "care" }[] = [];
  const recent = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 14 * 864e5);
  if (recent.some((r) => r.risk === "urgent")) out.push({ level: "concerning", text: "A recent entry sounded like you needed support right away.", action: "crisis" });
  else if (recent.filter((r) => r.risk === "concerning").length >= 1) out.push({ level: "concerning", text: "A recent entry sounded heavy, with feelings of hopelessness or being stuck.", action: "therapist" });
  const ints = rows.filter((r) => r.intensity != null).map((r) => r.intensity as number);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const last = ints.slice(0, 3), prev = ints.slice(3, 6);
  let trend: "improving" | "steady" | "rising" | "unknown" = "unknown";
  if (last.length >= 2 && prev.length >= 2) { const d = avg(last) - avg(prev); trend = d <= -1 ? "improving" : d >= 1.5 ? "rising" : "steady"; if (trend === "rising") out.push({ level: "watch", text: "Your last few entries felt more intense than the ones before.", action: "therapist" }); }
  const heavy = recent.filter((r) => r.feelings.some((f) => /hopeless|numb|worthless|empty|trapped/.test(f))).length;
  if (heavy >= 2 && !out.some((o) => o.level === "concerning")) out.push({ level: "concerning", text: "Feelings like hopelessness or numbness have shown up in more than one recent entry.", action: "therapist" });
  return { trend, signals: out };
}
