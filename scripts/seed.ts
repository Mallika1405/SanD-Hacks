import { config } from "dotenv";
config({ path: ".env.local" });
import { q } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { DEMO_PASSWORD, DEMOS } from "../lib/demo";

// Deterministic pseudo-random so the dummy data is the same every time.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const daysAgo = (d: number, hour = 12) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(hour, Math.floor(rnd() * 50), 0, 0); return t.toISOString(); };
const daysAhead = (d: number, hour: number) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(hour, 0, 0, 0); return t.toISOString(); };

async function person(d: (typeof DEMOS)[number], conditions: string[]) {
  await q("DELETE FROM devices WHERE id IN (SELECT device_id FROM accounts WHERE handle=$1)", [d.handle]);
  const [dev] = await q<{ id: string }>("INSERT INTO devices DEFAULT VALUES RETURNING id");
  const { salt, hash } = hashPassword(DEMO_PASSWORD);
  await q("INSERT INTO accounts(handle, password_hash, salt, device_id) VALUES ($1,$2,$3,$4)", [d.handle, hash, salt, dev.id]);
  await q("INSERT INTO profiles(device_id, display_name, conditions, onboarded) VALUES ($1,$2,$3,true)", [dev.id, d.name, conditions]);
  return dev.id;
}
const log = (dev: string, kind: string, data: object, at: string) => q("INSERT INTO tracker_logs(device_id, kind, data, created_at) VALUES ($1,$2,$3,$4)", [dev, kind, JSON.stringify(data), at]);
const diary = (dev: string, at: string, e: { title: string; summary: string; heard: string; feelings: string[]; themes: string[]; intensity: number; quote?: string; risk?: string; note?: string }) =>
  q("INSERT INTO diary_entries(device_id, created_at, title, summary, heard, feelings, themes, intensity, quote, risk, risk_note, duration_s) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [dev, at, e.title, e.summary, e.heard, e.feelings, e.themes, e.intensity, e.quote ?? null, e.risk ?? "none", e.note ?? null, 120 + Math.floor(rnd() * 300)]);
const session = (dev: string, flow: string, at: string, tried: string[], helped: string[]) =>
  q("INSERT INTO sessions(device_id, flow, state, ctx, started_at, ended_at, helpful_exercise_ids, summary) VALUES ($1,$2,'followup',$3,$4,$4,$5,$6)",
    [dev, flow, JSON.stringify({ tried, helped, worse: [], recent: [], turns: 4 }), at, helped, `${flow}; tried ${tried.join(", ")}; helped ${helped.join(", ") || "none"}`]);
const prefs = (dev: string, favorite: string, hard: string) =>
  q("INSERT INTO preferences(device_id, prefers, checkins_opt_in) VALUES ($1,$2,true)", [dev, JSON.stringify({ favorite_exercise: favorite, hard_times: hard })]);
const plan = (dev: string, therapist: string, modality: string, freq: string, nextInDays: number, hour: number, notes?: string) =>
  q("INSERT INTO therapy_plans(device_id, therapist_name, modality, frequency, next_at, notes) VALUES ($1,$2,$3,$4,$5,$6)", [dev, therapist, modality, freq, daysAhead(nextInDays, hour), notes ?? null]);
const hw = (dev: string, title: string, detail: string, due: number, done: boolean) =>
  q("INSERT INTO therapy_homework(device_id, title, detail, due_on, done_at, created_at) VALUES ($1,$2,$3,(now() + ($4 || ' days')::interval)::date,$5,$6)", [dev, title, detail, String(due), done ? daysAgo(Math.max(0, -due) + 1) : null, daysAgo(6)]);
const tsess = (dev: string, daysBack: number, hour: number, attended: boolean, notes?: string) =>
  q("INSERT INTO therapy_sessions(device_id, held_at, attended, notes) VALUES ($1,$2,$3,$4)", [dev, daysAgo(daysBack, hour), attended, notes ?? null]);

(async () => {
  /* ---------------- Maya: OCD, six weeks into ERP, improving ---------------- */
  let dev = await person(DEMOS[0], ["ocd", "gad"]);
  for (let i = 0; i < 40; i++) {
    const day = 41 - Math.floor(i * 1.0), prog = i / 40; // progress 0 -> 1
    const r = rnd(), resp = r < 0.7 - prog * 0.5 ? "did" : r < 0.88 - prog * 0.15 ? "delayed" : "resisted";
    const before = Math.round(6 + rnd() * 3), delay = resp === "delayed" ? pick([2, 5, 5, 10, 10, 15, 20].filter((m) => m <= 4 + prog * 18)) : undefined;
    await log(dev, "ocd_urge", { trigger: pick(["Checking (door, stove)", "Checking (door, stove)", "Contamination", "Reassurance", "Harm thoughts", "Mental review"]), urge: pick(["Check", "Check", "Ask for reassurance", "Wash or clean", "Review in my head"]), response: resp, delay_min: delay, before, after: Math.max(1, before - (resp === "did" ? 1 : resp === "delayed" ? 3 : 5) - Math.round(prog * 2)) }, daysAgo(day, pick([8, 13, 19, 22])));
  }
  for (let d = 28; d >= 0; d -= 3) await log(dev, "daily", { mood: 2 + Math.round((28 - d) / 14) + (rnd() > 0.7 ? 1 : 0), anxiety: Math.max(2, Math.round(7 - (28 - d) / 8 + rnd() * 2)), sleep: pick(["5 to 7h", "7 to 9h", "5 to 7h"]), helped: [pick(["Slow breathing", "Juno", "A walk"])] }, daysAgo(d, 21));
  const mayaDiary: [number, Parameters<typeof diary>[2]][] = [
    [26, { title: "The stove again", summary: "You went back to check the stove four times before leaving for work and arrived late and shaken. It felt like if you didn't check, something terrible would be your fault.", heard: "What I heard is a lot of fear that sounds like responsibility, with shame about being late underneath.", feelings: ["anxious", "ashamed", "exhausted"], themes: ["checking", "work", "shame"], intensity: 8, quote: "I know it's off but I can't trust that I know" }],
    [19, { title: "Tried waiting", summary: "You told yourself to wait ten minutes before going back to check, and made it to seven. It was awful but the urge dipped. You told your therapist you were proud and scared.", heard: "What I heard is real effort, with pride and fear sitting side by side.", feelings: ["proud", "scared", "tired"], themes: ["checking", "therapy", "progress"], intensity: 6, quote: "seven minutes felt like an hour" }],
    [12, { title: "A hard Sunday", summary: "You spent the afternoon reading about 'what if' scenarios and asked your partner for reassurance twice. You noticed the pattern afterwards and felt discouraged.", heard: "What I heard is discouragement, but also that you noticed the loop.", feelings: ["discouraged", "frustrated"], themes: ["reassurance", "partner", "weekend"], intensity: 7, quote: "I asked again even though I know it doesn't help" }],
    [6, { title: "Left the house first try", summary: "You locked the door, looked once, and left. You felt the urge for about twenty minutes on the way to work and let it pass without going back.", heard: "What I heard is relief, and a bit of disbelief that it worked.", feelings: ["relieved", "surprised", "proud"], themes: ["checking", "progress", "work"], intensity: 4, quote: "I just kept walking" }],
    [2, { title: "Tired but okay", summary: "A busy week. You had two urges to wash your hands more than needed and delayed both. You're sleeping a little better.", heard: "What I heard is tiredness, with steadier footing than a few weeks ago.", feelings: ["tired", "steady"], themes: ["washing", "sleep", "progress"], intensity: 4 }],
  ];
  for (const [d, e] of mayaDiary) await diary(dev, daysAgo(d, 22), e);
  for (const [d, f, tried, helped] of [[30, "intrusive", ["intr-notice", "exhale-breath"], ["intr-notice"]], [21, "intrusive", ["intr-uncertainty"], ["intr-uncertainty"]], [10, "intrusive", ["intr-notice", "intr-task"], ["intr-task"]], [4, "intrusive", ["intr-uncertainty", "ground-54321"], ["intr-uncertainty"]]] as const) await session(dev, f, daysAgo(d, 20), [...tried], [...helped]);
  await prefs(dev, "intr-uncertainty", "evenings");
  await plan(dev, "Dr. Priya Raman", "ERP therapy", "weekly", 3, 16, "Focus: checking and reassurance-seeking");
  await hw(dev, "One look at the stove, then leave", "Look once, say 'maybe, maybe not', walk out", 2, false);
  await hw(dev, "Delay hand-washing by 10 minutes", "Use the urge timer, note how it changes", 3, false);
  await hw(dev, "No reassurance texts for a full day", "Tell Sam the plan beforehand", 1, true);
  for (const [b, att] of [[36, true], [29, true], [22, true], [15, true], [8, false], [1, true]] as const) await tsess(dev, b, 16, att, att ? "Worked on exposure hierarchy" : "Missed: work ran late");

  /* ---------------- Jordan: panic, CBT, one missed session, recent entries getting heavier ---------------- */
  dev = await person(DEMOS[1], ["panic"]);
  for (let i = 0; i < 16; i++) { const prog = i / 16; await log(dev, "panic_episode", { intensity: Math.round(9 - prog * 3 + rnd()), minutes: Math.max(5, Math.round(28 - prog * 18 + rnd() * 6)), trigger: pick(["Crowded place", "Caffeine", "Bed / night", "Work or school", "None I can tell"]), helped: [pick(["Slow breathing", "Grounding", "Juno"]), ...(rnd() > 0.6 ? ["A walk"] : [])] }, daysAgo(40 - i * 2.4, pick([9, 15, 23]))); }
  for (let d = 20; d >= 0; d -= 2) await log(dev, "daily", { mood: d < 6 ? 2 : 3, anxiety: d < 6 ? 7 + Math.round(rnd() * 2) : 5, sleep: d < 6 ? "Under 5h" : "5 to 7h", helped: [pick(["Slow breathing", "Grounding"])] }, daysAgo(d, 21));
  const jd: [number, Parameters<typeof diary>[2]][] = [
    [22, { title: "Subway, but I got off", summary: "You felt a wave start on the train, got off at the next stop, and did the breathing until it passed. It took about ten minutes.", heard: "What I heard is that you handled it the way you practiced, and it cost you energy.", feelings: ["shaky", "proud"], themes: ["commute", "breathing", "progress"], intensity: 5 }],
    [9, { title: "Not sleeping", summary: "You've been waking at 3am with your heart racing for the last few nights and dreading the next one. You cancelled plans twice this week.", heard: "What I heard is dread building around nighttime, and pulling away from people.", feelings: ["dread", "tired", "lonely"], themes: ["sleep", "avoiding", "nights"], intensity: 7, risk: "watch", note: "Poor sleep and cancelling plans can feed anxiety. It could help to tell your therapist what's been happening at night." }],
    [3, { title: "Another bad night", summary: "Three nights in a row now. You skipped your last therapy session because you were too wiped out, and you feel like you're going backwards.", heard: "What I heard is exhaustion, and worry that all the progress is slipping.", feelings: ["exhausted", "discouraged", "worried"], themes: ["sleep", "therapy", "setback"], intensity: 8, risk: "watch", note: "It sounds like you're running on empty. Rescheduling your session sooner rather than later might help." }],
  ];
  for (const [d, e] of jd) await diary(dev, daysAgo(d, 23), e);
  for (const [d, f, tried, helped] of [[25, "panic", ["orient-posture", "exhale-breath"], ["exhale-breath"]], [14, "panic", ["exhale-breath", "name-it"], ["name-it"]], [5, "panic", ["orient-posture", "exhale-breath", "ground-54321"], ["ground-54321"]], [2, "panic", ["exhale-breath"], []]] as const) await session(dev, f, daysAgo(d, 3), [...tried], [...helped]);
  await prefs(dev, "exhale-breath", "nights");
  await plan(dev, "Dr. Min-jun Kim", "CBT for panic", "biweekly", 5, 11);
  await hw(dev, "Practice breathing 5 minutes, twice a day", "Use the pacer on the Talk page", 1, false);
  await hw(dev, "Interoceptive exercise: spin in chair 30 seconds", "Do it with your therapist's guidance only", 4, false);
  for (const [b, att, n] of [[42, true, "Psychoeducation"], [28, true, "Breathing retraining"], [14, true, "Started interoceptive work"], [0, false, "Missed: exhausted"]] as const) await tsess(dev, b, 11, att, n);

  /* ---------------- Sam: burnout and worry, one heavy entry flagged, no therapist yet ---------------- */
  dev = await person(DEMOS[2], ["overwhelm", "gad"]);
  for (let d = 30; d >= 0; d--) if (d % 2 === 0 || d < 6) await log(dev, "daily", { mood: d < 8 ? 1 + (rnd() > 0.6 ? 1 : 0) : 2 + (rnd() > 0.5 ? 1 : 0), anxiety: Math.min(10, 6 + Math.round((30 - d) / 10) + Math.round(rnd() * 2)), sleep: pick(["Under 5h", "Under 5h", "5 to 7h"]), helped: rnd() > 0.5 ? [pick(["A walk", "Talked to someone", "Nothing yet"])] : [] }, daysAgo(d, 22));
  const sd: [number, Parameters<typeof diary>[2]][] = [
    [18, { title: "Behind on everything", summary: "Deadlines are stacking up and you can't see the end of the list. You stayed late again and skipped dinner.", heard: "What I heard is pressure with no room to breathe, and your own needs coming last.", feelings: ["overwhelmed", "stressed", "tired"], themes: ["work", "deadlines", "meals"], intensity: 7 }],
    [10, { title: "Cancelled on everyone", summary: "You cancelled on friends again because you don't have the energy to pretend you're okay. You're not eating much and mostly lie on the couch.", heard: "What I heard is exhaustion, and pulling away from the people who'd help.", feelings: ["drained", "isolated"], themes: ["work", "friends", "appetite"], intensity: 8, risk: "watch", note: "Pulling away and not eating much are worth taking seriously. Telling someone you trust, or a doctor, could really help." }],
    [3, { title: "I don't see the point", summary: "You said it feels pointless to keep trying, that you feel like a burden at work, and that nothing you do matters much. You didn't say anything about hurting yourself, but it was a very low night.", heard: "What I heard is deep tiredness and a sense of being stuck, with the feeling that you're a burden.", feelings: ["hopeless", "empty", "exhausted"], themes: ["work", "burden", "stuck"], intensity: 9, risk: "concerning", quote: "what's the point of trying", note: "This sounds really heavy, and you don't have to carry it alone. Please consider telling someone you trust or reaching out to a professional soon." }],
  ];
  for (const [d, e] of sd) await diary(dev, daysAgo(d, 23), e);
  for (const [d, f, tried, helped] of [[12, "overwhelm", ["ow-settle", "exhale-breath"], ["exhale-breath"]], [4, "overwhelm", ["ow-one-thing"], []]] as const) await session(dev, f, daysAgo(d, 21), [...tried], [...helped]);
  await prefs(dev, "exhale-breath", "afternoons");

  /* ---------------- Riley: social anxiety, group therapy ---------------- */
  dev = await person(DEMOS[3], ["social"]);
  for (let d = 24; d >= 0; d -= 2) await log(dev, "daily", { mood: 3, anxiety: Math.max(2, 6 - Math.round((24 - d) / 8) + Math.round(rnd() * 2)), sleep: "7 to 9h", helped: [pick(["Slow breathing", "Talked to someone", "Grounding"])] }, daysAgo(d, 20));
  for (let i = 0; i < 6; i++) await log(dev, "panic_episode", { intensity: 6 + Math.round(rnd() * 2) - Math.round(i / 3), minutes: 10 - i, trigger: pick(["Crowded place", "Work or school"]), helped: ["Grounding"], where: "out in public" }, daysAgo(30 - i * 5, 12));
  const rd: [number, Parameters<typeof diary>[2]][] = [
    [14, { title: "Spoke up in the meeting", summary: "You asked one question in the team meeting even though your voice shook. Nobody reacted badly. You replayed it for hours afterwards anyway.", heard: "What I heard is courage, followed by a long replay.", feelings: ["nervous", "proud", "self-critical"], themes: ["work", "speaking up", "rumination"], intensity: 6 }],
    [5, { title: "Group therapy, third week", summary: "You said your name and one sentence in group. It was less terrifying than expected. Someone else shared something similar.", heard: "What I heard is a small, real step and the relief of not being the only one.", feelings: ["relieved", "hopeful"], themes: ["group", "connection", "progress"], intensity: 3 }],
  ];
  for (const [d, e] of rd) await diary(dev, daysAgo(d, 21), e);
  await session(dev, "panic", daysAgo(8, 12), ["orient-posture", "ground-54321"], ["ground-54321"]);
  await prefs(dev, "ground-54321", "mornings");
  await plan(dev, "Ana Whitfield, LMFT", "Group therapy for social anxiety", "weekly", 1, 18);
  await hw(dev, "Make small talk with one person this week", "A cashier counts", 3, false);
  await hw(dev, "Thought record after the group", "What I predicted vs what happened", 0, true);
  for (const [b, att] of [[27, true], [20, true], [13, true], [6, true]] as const) await tsess(dev, b, 18, att, "Group session");

  /* ---------------- Alex: brand new ---------------- */
  dev = await person(DEMOS[4], []);
  await q("UPDATE profiles SET onboarded=false WHERE device_id=$1", [dev]);

  const [c] = await q<any>("SELECT count(*)::int a, (SELECT count(*) FROM tracker_logs)::int t, (SELECT count(*) FROM diary_entries)::int d, (SELECT count(*) FROM therapy_sessions)::int s FROM accounts");
  console.log(`Seeded ${c.a} demo profiles (${c.t} tracker logs, ${c.d} diary entries, ${c.s} therapy sessions). Demo password: ${DEMO_PASSWORD}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
