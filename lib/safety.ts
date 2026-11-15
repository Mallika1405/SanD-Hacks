import { gemini } from "./gemini";

/** none < uncertain < medical < crisis. Deterministic rules ALWAYS run; Gemini can only escalate, never downgrade. */
export type SafetyLevel = "none" | "uncertain" | "medical" | "crisis";
const rank: Record<SafetyLevel, number> = { none: 0, uncertain: 1, medical: 2, crisis: 3 };

const CRISIS = [
  /\bkill(ing)? my ?self\b/, /\bsuicid/, /\bend (my|my own) life\b/, /\bend it all\b/, /\bwant(ed)? to die\b/, /\bwish i (was|were) dead\b/,
  /\bdon'?t want to (be alive|live|be here|exist)\b/, /\b(hurt|harm|cut|burn) my ?self\b/, /\bself[- ]?harm/, /\bbetter off (dead|without me)\b/,
  /\bno reason to (live|go on)\b/, /\boverdos/, /\btake all (of )?(my|the) (pills|meds|medication)\b/, /\bnot worth living\b/, /\b(took|taken|swallowed|had) (a bunch|too many|a lot|all) (of )?(the |my )?(pills|meds|medication|tablets)\b/, /\bhow many (pills|tablets) (would|does it take)\b/, /\bcan'?t (go on|do this anymore)\b/,
];
const MEDICAL = [
  /\bchest (pain|pressure|tightness|is tight|hurts|feels tight)\b/, /\bpain in (my )?(chest|left arm|jaw)\b/, /\bmy chest\b.*\b(hurts|pain|crushing|tight)\b/,
  /\b(faint(ing)?|pass(ing)? out|passed out|black(ing|ed)? out|about to collapse)\b/, /\b(can'?t|cannot|unable to|trouble|hard to|difficulty|struggling to) breath/, /\bshort of breath\b/,
  /\bnot able to breathe\b/, /\bheart attack\b/, /\bstroke\b/, /\bface (is )?droop/, /\bnumb(ness)? (on|in) (one|my left|my right)/, /\bslurr(ed|ing) (my )?(words|speech)\b/,
  /\bconfus(ed|ion)\b/, /\bdon'?t know where i am\b/, /\bcan'?t (see|move my (arm|leg|face))\b/, /\bthroat (is )?(closing|swelling)\b/,
];
const UNCERTAIN = [/\bdizz(y|iness)\b/, /\blight[- ]?headed\b/, /\btingling\b/, /\bnumb\b/, /\bfeel(s|ing)? (unreal|like i'?m not here|detached|far away)\b/, /\bvision (is )?(blurry|going)\b/];

export function rulesLevel(text: string): SafetyLevel {
  const t = text.toLowerCase().replace(/[’]/g, "'");
  if (CRISIS.some((r) => r.test(t))) return "crisis";
  if (MEDICAL.some((r) => r.test(t))) return "medical";
  if (UNCERTAIN.some((r) => r.test(t))) return "uncertain";
  return "none";
}

const SYSTEM = `You are a safety classifier for a mental-health support demo. Read one user utterance said during a panic, intrusive-thought or overwhelm session.
Reply JSON {"level":"none"|"uncertain"|"medical"|"crisis"}.
crisis = any thoughts of suicide, self-harm, wanting to die, or harming others, even indirect or past-tense-but-present.
medical = chest pain or pressure, fainting, trouble breathing, stroke signs, confusion/disorientation, or any physical symptom that could be an emergency. Never assume symptoms are anxiety.
uncertain = ambiguous physical symptoms (dizziness, numbness, feeling unreal with body symptoms) or unclear safety.
none = ordinary distress with no warning signs. A racing or pounding heart, shaking, sweating or fear on their own are typical panic and are 'none'; only chest PAIN or PRESSURE, fainting, breathing trouble or neurological signs are medical. When unsure between two levels, choose the more serious one.`;

export async function assessSafety(text: string): Promise<SafetyLevel> {
  const rules = rulesLevel(text);
  if (rules === "crisis" || !text.trim()) return rules; // already the top level; do not wait for the model
  const g = await gemini<{ level: SafetyLevel }>(`Utterance: """${text.slice(0, 600)}"""`, true, { system: SYSTEM, timeoutMs: 2500 });
  const gl = g && g.level in rank ? g.level : "none";
  return rank[gl] > rank[rules] ? gl : rules;
}

/** Fixed, reviewed wording for warning signs. The model never rewrites these. */
export const CRISIS_SEGS = [
  { text: "I'm really glad you told me. You deserve support right now.", pause_ms: 1500 },
  { text: "Please call or text 988 now. It's free, and someone will answer.", pause_ms: 1500 },
  { text: "If you're in immediate danger, call 911.", pause_ms: 1500 },
  { text: "The numbers are on your screen. I'm staying right here with you.", pause_ms: 1000 },
];
export const MEDICAL_SEGS = [
  { text: "Chest pain, trouble breathing, or feeling faint can be serious, and I can't tell what's causing it.", pause_ms: 1500 },
  { text: "If this is new, severe, or different from usual, please call 911 now.", pause_ms: 1500 },
  { text: "The button is on your screen. I won't guess that this is anxiety.", pause_ms: 1000 },
];
export const SAFETY_QUESTION = [
  { text: "I want to check something first.", pause_ms: 800 },
  { text: "Are you having chest pain, trouble breathing, or feeling like you might faint? Please say yes or no.", pause_ms: 500, listen: true },
];
