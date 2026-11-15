import { q } from "./db";
import { gemini } from "./gemini";
import { assessSafety, CRISIS_SEGS, MEDICAL_SEGS, SAFETY_QUESTION } from "./safety";
import { BY_FLOW, Flow as ExerciseFlow, getExercise } from "./exercises";
type Flow = ExerciseFlow | "checkin";
import { out, OutSeg, Seg } from "./speech";
import { listSourced, slug } from "./techniques";

export type State = "start" | "support" | "adapt" | "finish" | "followup" | "crisis";
type Pending = "flow" | "safety" | "continue" | "finish_choice" | "checkin" | "checkin_reply" | "rate" | "situation";
type Ctx = {
  exId?: string; checkinId?: string; ratings?: number[]; sit?: string; rkey?: string; rcount?: number; tried: string[]; helped: string[]; worse: string[]; slow?: boolean; pending?: Pending;
  resumeIdx?: number; recent: { r: "u" | "a"; t: string }[]; turns: number;
};
export type TurnInput = {
  event?: "start" | "segments_done" | "okay_now" | "resume" | "help_now" | "safe_now"; text?: string; spoken_idx?: number; interrupted?: boolean;
};
export type TurnOut = {
  say: OutSeg[]; lead: number; exBase: number; state: State; flow: Flow; exerciseId?: string; exerciseTitle?: string; research?: { key: string; flow: string; sit: string };
  ui: { crisis?: "self_harm" | "medical"; finish?: boolean; followup?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean; rate?: boolean; source?: { name: string; url: string; title: string } };
};

const norm = (t: string) => t.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
const S = (text: string, pause_ms = 800, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });

type Intent = "worse" | "different" | "slower" | "stop" | "helped" | "pause" | "trusted" | "yes" | "no" | "talk";
export function intent(text: string): Intent {
  const n = norm(text);
  if (/(worse|more anxious|more scared|getting worse|scarier|making it worse)/.test(n)) return "worse";
  if (/(different|something else|another one|not working|doesn't work|isn't (helping|working)|didn't help|try another)/.test(n)) return "different";
  if (/(slower|too fast|slow down|go slower|slowly)/.test(n)) return "slower";
  if (/(message|text someone|text a friend|reach out|call someone|someone i trust|trusted)/.test(n)) return "trusted";
  if (/(that helped|it helped|helping|feeling better|feel better|better now|thank you|thanks)/.test(n)) return "helped";
  if (/\b(stop|enough|done|that's all)\b/.test(n) || /^i'?m (ok|okay|fine|good|alright)( now)?$/.test(n)) return "stop";
  if (/\b(wait|hold on|pause)\b/.test(n)) return "pause";
  if (/^(yes|yeah|yep|yup|sure|ok|okay|please|continue|keep going|more|again|go on)\b/.test(n)) return "yes";
  if (/^(no|nope|nah|not really|no thanks)\b/.test(n)) return "no";
  return "talk";
}

function detectFlow(t: string): Exclude<ExerciseFlow, "unsure"> | null {
  const n = norm(t);
  if (/(thought|thinking|what if|stuck|can't stop|cant stop|intrusive|obsess|loop|checking|replaying)/.test(n)) return "intrusive";
  if (/(panic|attack|heart|racing|pounding|scared|terrified|can't calm)/.test(n)) return "panic";
  if (/(overwhelm|too much|a lot|everything|stress|drowning|can't cope)/.test(n)) return "overwhelm";
  return null;
}

const BANNED = /(don'?t worry|you'?re fine|you are fine|it'?s nothing|won'?t happen|will not happen|nothing (bad )?will|i promise|everything will be (ok|okay|fine)|that thought is meaningless|just relax|calm down|you'?re overreacting)/i;
const FREE_SYSTEM = (flow: string) => `You speak aloud to someone who is distressed. Reply with ONE or TWO very short, calm sentences (max 25 words total). Acknowledge what they said without judging. Never diagnose. Never promise they will be okay or that something will or won't happen. Never say "don't worry", "you're fine", or "calm down". ${flow === "intrusive" ? "They are having intrusive thoughts: do NOT analyze, discuss, or reassure about the content of the thought (reassurance can reinforce the pattern). Acknowledge the distress only." : ""} Reply JSON {"say":"..."}.`;

async function freeTalk(flow: string, text: string, recent: Ctx["recent"]): Promise<string> {
  const hist = recent.slice(-4).map((m) => `${m.r === "u" ? "Person" : "You"}: ${m.t}`).join("\n");
  const g = await gemini<{ say: string }>(`${hist}\nPerson: ${text.slice(0, 400)}`, true, { system: FREE_SYSTEM(flow), timeoutMs: 4500 });
  const say = g?.say?.trim();
  if (!say || BANNED.test(say) || say.split(/\s+/).length > 40) return "I hear you. That sounds really hard.";
  return say;
}

const WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function parseRating(text: string): number | null {
  const n = norm(text);
  const d = n.match(/\b(10|[0-9])\b/); if (d) return Number(d[1]);
  const w = n.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/); return w ? WORDS[w[1]] : null;
}
const FLOW_LABEL: Record<string, string> = { panic: "panic attack", overwhelm: "feeling overwhelmed" };

const ACKS = ["Good.", "That's it.", "Nicely done.", "Okay. Stay with that."];

export async function turn(sessionId: string, deviceId: string, input: TurnInput): Promise<TurnOut> {
  const [row] = await q<any>("SELECT * FROM sessions WHERE id=$1 AND device_id=$2", [sessionId, deviceId]);
  if (!row) throw new Error("session not found");
  const ctx: Ctx = { tried: [], helped: [], worse: [], recent: [], turns: 0, ...(row.ctx ?? {}) };
  let state: State = row.state;
  let flow: Flow = row.flow;
  const [pr] = await q<{ prefers: any }>("SELECT prefers FROM preferences WHERE device_id=$1", [deviceId]);
  const favorite: string | undefined = pr?.prefers?.favorite_exercise;
  // Techniques Bright Data found for this person's situation (never used for intrusive thoughts: reviewed exercises only).
  const sourced = ctx.rkey && flow !== "intrusive" ? await listSourced(ctx.rkey) : [];
  const exMap = new Map<string, any>(sourced.map((e) => [e.id, e]));
  const getEx = (id: string): any => exMap.get(id) ?? getExercise(id);
  let research: TurnOut["research"];
  const startResearch = (sit: string, force = false) => {
    if (flow === "intrusive" || flow === "unsure") return;
    if (ctx.rkey && !force) return;
    if ((ctx.rcount ?? 0) >= 2) return;
    const f = flow === "panic" ? "panic" : "overwhelm";
    const key = `${f}:${slug(sit)}`;
    if (key === ctx.rkey) return;
    ctx.sit = sit; ctx.rkey = key; ctx.rcount = (ctx.rcount ?? 0) + 1; research = { key, flow: f, sit };
  };
  let say: Seg[] = [];
  const ui: TurnOut["ui"] = {};
  let ended = false;
  let lead = -1; // how many leading non-exercise segments are in `say`
  let exBase = 0; // index in the exercise of the first exercise segment in `say`

  const text = input.text?.trim() || "";
  if (text) { ctx.recent.push({ r: "u", t: text.slice(0, 300) }); ctx.turns++; }

  const pick = (f: Exclude<ExerciseFlow, "unsure">) => {
    const lib = BY_FLOW[f], srcIds = sourced.map((e) => e.id);
    const unseen = (ids: string[]) => ids.filter((id) => !ctx.tried.includes(id) && !ctx.worse.includes(id));
    // First technique is always a reviewed one (instant). After that, prefer what was researched for her situation.
    let order = ctx.tried.length === 0 ? [...unseen(lib), ...unseen(srcIds)] : [...unseen(srcIds), ...unseen(lib)];
    if (!order.length) { ctx.tried = []; order = [...srcIds, ...lib].filter((id) => !ctx.worse.includes(id)); }
    if (!order.length) order = lib;
    return favorite && ctx.tried.length === 0 && order.includes(favorite) ? favorite : order[0];
  };
  const begin = (leadSegs: Seg[] = []) => {
    const f = (flow === "unsure" || flow === "checkin" ? "overwhelm" : flow) as Exclude<ExerciseFlow, "unsure">;
    const id = pick(f); const ex = getEx(id);
    ctx.exId = id; ctx.tried.push(id); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    const l = id.startsWith("src:") ? [...leadSegs, S(`Here's an approach from ${ex.source_name}.`, 500)] : leadSegs;
    say = [...l, ...ex.segments.map((s: Seg) => ({ ...s }))]; lead = l.length; exBase = 0;
  };
  const replayFrom = (idx: number, leadSegs: Seg[] = []) => {
    const ex = getEx(ctx.exId!); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    const rest = ex.segments.slice(Math.max(0, idx));
    say = [...leadSegs, ...(rest.length ? rest : [S("We've reached the end of this one.", 800)])]; lead = leadSegs.length; exBase = Math.max(0, idx);
  };
  const askRate = (leadSegs: Seg[] = []) => {
    state = "adapt"; ctx.pending = "rate"; ui.rate = true;
    say = [...leadSegs, S("On a scale of one to ten, where is it now? One is calm. Ten is the hardest it's been.", 300, true)];
  };
  const crisis = (kind: "self_harm" | "medical") => {
    state = "crisis"; ui.crisis = kind; ctx.pending = undefined;
    say = (kind === "medical" ? MEDICAL_SEGS : CRISIS_SEGS).map((s) => ({ ...s }));
  };
  const finish = () => {
    state = "finish"; ctx.pending = "finish_choice"; ui.finish = true;
    say = [S("You stayed with it. That counts.", 900), S("Would you like to keep going, stop here, or send a message to someone you trust?", 400, true)];
  };
  const followup = async () => {
    state = "followup"; ctx.pending = "checkin"; ui.followup = true; ended = true;
    const [r] = await q<{ n: number }>("SELECT count(*)::int n FROM sessions WHERE device_id=$1 AND started_at > now() - interval '14 days'", [deviceId]);
    ui.suggestCare = (r?.n ?? 0) >= 2;
    say = [S("Okay. I'll be here whenever you need me.", 900), S("Would you like me to check in with you tomorrow? You can say yes or no, or tap a button.", 400, true)];
  };

  // ---------------- 1. SAFETY FIRST: every utterance, before anything else ----------------
  let handled = false;
  if (text && state !== "crisis") {
    if (ctx.pending === "safety") {
      ctx.pending = undefined;
      const i = intent(text);
      if (i === "yes" || /\b(yes|yeah|a little|i think so|maybe)\b/.test(norm(text))) { crisis("medical"); handled = true; }
      else if (i === "no") { say = [S("Thank you for telling me. Let's keep going, gently.", 800)]; { const l = say; if (ctx.exId) replayFrom(ctx.resumeIdx ?? 0, l); else begin(l); } handled = true; }
    }
    if (!handled) {
      const level = await assessSafety(text);
      if (level === "crisis") { crisis("self_harm"); handled = true; }
      else if (level === "medical") { crisis("medical"); handled = true; }
      else if (level === "uncertain") {
        ctx.pending = "safety"; ctx.resumeIdx = (input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1);
        say = SAFETY_QUESTION.map((s) => ({ ...s })); handled = true;
      }
    }
  }

  // ---------------- 2. state machine ----------------
  if (!handled) {
    if (state === "crisis") {
      if (input.event === "safe_now") {
        state = "adapt"; ctx.pending = "continue";
        say = [S("I'm glad you're safe right now. We can keep going, or stop here. Whatever you'd like.", 400, true)];
      } else {
        ui.crisis = ui.crisis ?? "self_harm";
        say = text ? [S("I'm here. Please call or text 988 now. The number is on your screen.", 500)] : [];
      }
    } else if (input.event === "help_now") crisis("self_harm");
    else if (input.event === "start" && flow === "checkin") {
      if (ctx.checkinId) await q("UPDATE checkins SET done_at=now() WHERE id=$1 AND device_id=$2", [ctx.checkinId, deviceId]);
      const helped = favorite ? getExercise(favorite).title.toLowerCase() : null;
      const g = await gemini<{ say: string }>(
        `Write ONE short, warm check-in sentence (max 20 words) for someone who asked to be checked on. No pressure, no advice. ${helped ? `Something that helped them before (they agreed to be remembered): ${helped}.` : ""} ${pr?.prefers?.hard_times ? `They said ${pr.prefers.hard_times} can be harder.` : ""} Reply JSON {"say":"..."}`,
        true, { timeoutMs: 4000 });
      const line = g?.say && !BANNED.test(g.say) && g.say.split(/\s+/).length <= 30 ? g.say.trim() : "Hi. It's Somewhere, checking in like you asked.";
      ctx.pending = "checkin_reply"; state = "start";
      say = [S(line, 600), S("How are you doing right now?", 400, true)];
    } else if (input.event === "start") {
      if (flow === "unsure") { ctx.pending = "flow"; say = [S("I'm here with you.", 700), S("What's it like right now? You can say panic, a thought that won't leave, or that it's all a lot.", 400, true)]; }
      else { startResearch(FLOW_LABEL[flow] ?? "feeling overwhelmed"); begin([S("I'm here with you. I'll guide you through this, one step at a time.", 700)]); }
    } else if (input.event === "okay_now") finish();
    else if (input.event === "resume") { if (ctx.exId) replayFrom((input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1)); else begin(); }
    else if (input.event === "segments_done") {
      if (state === "support") askRate();
    } else if (text) {
      const i = intent(text);
      const resumeAt = (input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1);
      if (ctx.pending === "rate") {
        const n = parseRating(text);
        if (n != null) {
          const prev = ctx.ratings?.[ctx.ratings.length - 1]; (ctx.ratings ??= []).push(n);
          const markHelped = () => { if (ctx.exId && !ctx.helped.includes(ctx.exId)) ctx.helped.push(ctx.exId); };
          if (n <= 3) { markHelped(); ctx.pending = "continue"; state = "adapt"; say = [S(`${n}. That's a lot lower. I'm glad.`, 500), S("Would you like to stay with me a little longer, or stop here?", 400, true)]; }
          else if (prev == null && n >= 7) { ctx.pending = "situation"; say = [S("Thank you. That's a lot, and I'm still here.", 600), S("If you want to tell me, what's the hardest part right now? Or say skip, and I'll try something different.", 400, true)]; }
          else if (prev == null) begin([S(`${n}. Okay. Let's keep going, a little more.`, 600)]);
          else if (n < prev) { markHelped(); begin([S(`It's coming down, from ${prev} to ${n}. Let's keep going.`, 600)]); }
          else { begin([S("It's not moving much yet. That's okay. Let's try something different.", 700)]); }
        } else if (i === "stop") finish();
        else if (i === "different" || i === "worse") begin([S("Okay. Let's try something different.", 600)]);
        else if (i === "yes") begin([S("Okay.", 400)]);
        else askRate([S("A number from one to ten is fine.", 300)]);
      } else if (ctx.pending === "situation") {
        if (i === "different" || i === "no" || i === "stop" || /\bskip\b/.test(norm(text))) begin([S("Okay. Let's try something different.", 600)]);
        else {
          const g = await gemini<{ situation: string }>(`Summarize what this person is going through as a short neutral phrase (max 6 words, no diagnosis, e.g. "panic attack at work"): "${text.slice(0, 300)}". JSON {"situation":"..."}`, true, { timeoutMs: 3000 });
          const sit = g?.situation?.trim().toLowerCase().slice(0, 60);
          if (sit) startResearch(sit, true);
          const reply = await freeTalk(flow, text, ctx.recent);
          begin([S(reply, 700), S("Let's try something that might fit that better.", 600)]);
        }
      } else if (ctx.pending === "checkin_reply") {
        const n = norm(text);
        const neg = /(not good|not great|not okay|not ok|bad|anxious|rough|hard|worse|tough|stress|panic|scared|overwhelm|struggl|tired|awful|terrible|can't|cant)/.test(n);
        const pos = /\b(good|fine|okay|ok|better|great|well|alright|calm)\b/.test(n);
        if (neg) { flow = detectFlow(text) ?? "overwhelm"; begin([S("Thank you for telling me. Let's try something together.", 700)]); }
        else if (pos) { ctx.pending = undefined; ui.done = true; say = [S("I'm glad to hear that. I'm here whenever you need me.", 500)]; }
        else { const reply = await freeTalk("overwhelm", text, ctx.recent); ctx.pending = "continue"; state = "adapt"; say = [S(reply, 700), S("Would you like to try something together, or stop here?", 400, true)]; }
      } else if (ctx.pending === "flow") {
        const g = await gemini<{ flow: string; situation: string }>(`Someone in distress said: "${text.slice(0, 300)}". Which best fits: panic, intrusive (unwanted repeating thoughts), or overwhelm? Also summarize what they are going through as a short neutral phrase (max 6 words, no diagnosis, e.g. "panic attack at work"). JSON {"flow":"...","situation":"..."}`, true, { timeoutMs: 3500 });
        const f = detectFlow(text) ?? g?.flow;
        flow = (["panic", "intrusive", "overwhelm"].includes(f as string) ? f : "overwhelm") as Flow;
        startResearch((g?.situation ?? "").toLowerCase().slice(0, 60) || FLOW_LABEL[flow] || "feeling overwhelmed");
        begin([S("Thank you for telling me. I'll guide you through this, one step at a time.", 600)]);
      } else if (ctx.pending === "checkin") {
        if (i === "yes") { ui.checkinConsent = true; say = [S("Okay. I'll remember that. Take care of yourself.", 500)]; ui.done = true; }
        else { say = [S("No problem. Take care of yourself.", 500)]; ui.done = true; }
        ctx.pending = undefined;
      } else if (ctx.pending === "finish_choice") {
        if (i === "trusted") { ui.trusted = true; say = [S("Okay. A message is ready on your screen. You choose who gets it.", 500)]; }
        else if (i === "yes" || i === "talk" || i === "different") { if (ctx.exId) { ctx.tried = ctx.tried.filter((x) => x !== ctx.exId); } begin([S("Okay. Let's keep going.", 600)]); }
        else await followup();
      } else if (i === "stop") finish();
      else if (i === "trusted") { ui.trusted = true; say = [S("Okay. A message is ready on your screen. You choose who gets it.", 500)]; }
      else if (i === "slower") { ctx.slow = true; if (ctx.exId) replayFrom(resumeAt, [S("Okay. Slower.", 600)]); else begin([S("Okay. Slower.", 600)]); }
      else if (i === "worse") {
        if (ctx.exId) ctx.worse.push(ctx.exId);
        begin([S("Thank you for telling me. Let's try something different.", 700)]);
      } else if (i === "different") begin([S("Okay. Let's try something else.", 600)]);
      else if (i === "helped") {
        if (ctx.exId && !ctx.helped.includes(ctx.exId)) ctx.helped.push(ctx.exId);
        ctx.pending = "continue"; state = "adapt"; say = [S("I'm glad. Would you like to keep going, or stop here?", 400, true)];
      } else if (i === "pause") say = [];
      else if (ctx.pending === "continue" && (i === "yes")) { if (ctx.resumeIdx != null && ctx.exId) replayFrom(ctx.resumeIdx); else begin([S("Okay.", 400)]); }
      else if (ctx.pending === "continue" && i === "no") finish();
      else {
        // Free talk. If the person is answering a "say it out loud" step, just acknowledge and carry on.
        const ex = ctx.exId ? getEx(ctx.exId) : null;
        const cur = ex && input.spoken_idx != null ? ex.segments[input.spoken_idx] : null;
        const short = text.split(/\s+/).length <= 8;
        const seeksReassurance = flow === "intrusive" && /(am i|will i|is it|what if|do you think|are you sure|promise|tell me).*(okay|ok|fine|safe|happen|true|real|bad|wrong|crazy|dangerous)/.test(norm(text));
        if (seeksReassurance) {
          ctx.resumeIdx = resumeAt; ctx.pending = "continue"; state = "adapt";
          say = [S("I can't know that, and I don't think chasing the answer will help right now. Let's let the question stay open.", 900), S("Would you like to keep going, or try something different?", 400, true)];
        } else if (ex && cur?.listen && short && state === "support") { replayFrom(input.spoken_idx! + 1, [S(ACKS[ctx.turns % ACKS.length], 500)]); }
        else {
          const reply = await freeTalk(flow, text, ctx.recent);
          ctx.recent.push({ r: "a", t: reply });
          ctx.resumeIdx = resumeAt; ctx.pending = "continue"; state = "adapt";
          say = [S(reply, 700), S("Would you like to keep going, or try something different?", 400, true)];
        }
      }
    }
  }

  // ---------------- 3. persist (no transcripts: recent turns are purged when the session ends) ----------------
  if (ended || state === "followup" || ui.done) ctx.recent = [];
  if (say.length && say[0]) ctx.recent.push({ r: "a", t: say.map((s) => s.text).join(" ").slice(0, 200) });
  ctx.recent = ctx.recent.slice(-6);
  if (ended || ui.done) ctx.recent = [];
  const ex = ctx.exId ? getEx(ctx.exId) : null;
  if (ex?.source_url) ui.source = { name: ex.source_name, url: ex.source_url, title: ex.title };
  await q(
    `UPDATE sessions SET state=$2, ctx=$3, flow=$4, helpful_exercise_ids=$5, ended_at=CASE WHEN $6 THEN now() ELSE ended_at END,
       summary=CASE WHEN $6 THEN $7 ELSE summary END WHERE id=$1`,
    [sessionId, state, JSON.stringify(ctx), flow, ctx.helped, ended, `${flow}; tried ${ctx.tried.join(", ") || "none"}; helped ${ctx.helped.join(", ") || "none"}`]);

  if (lead < 0) lead = say.length;
  return { say: out(say, ctx.slow), lead, exBase, state, flow: flow as any, exerciseId: ctx.exId, exerciseTitle: ex?.title, ui, research };
}
