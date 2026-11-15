import { q } from "./db";
import { gemini } from "./gemini";
import { assessSafety, CRISIS_SEGS, MEDICAL_SEGS, SAFETY_QUESTION } from "./safety";
import { BY_FLOW, Flow, getExercise } from "./exercises";
import { out, OutSeg, Seg } from "./speech";

export type State = "start" | "support" | "adapt" | "finish" | "followup" | "crisis";
type Pending = "flow" | "safety" | "continue" | "finish_choice" | "checkin";
type Ctx = {
  exId?: string; tried: string[]; helped: string[]; worse: string[]; slow?: boolean; pending?: Pending;
  resumeIdx?: number; recent: { r: "u" | "a"; t: string }[]; turns: number;
};
export type TurnInput = {
  event?: "start" | "segments_done" | "okay_now" | "resume" | "help_now" | "safe_now"; text?: string; spoken_idx?: number; interrupted?: boolean;
};
export type TurnOut = {
  say: OutSeg[]; lead: number; exBase: number; state: State; flow: Flow; exerciseId?: string; exerciseTitle?: string;
  ui: { crisis?: "self_harm" | "medical"; finish?: boolean; followup?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean };
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

function detectFlow(t: string): Exclude<Flow, "unsure"> | null {
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

const ACKS = ["Good.", "That's it.", "Nicely done.", "Okay. Stay with that."];

export async function turn(sessionId: string, deviceId: string, input: TurnInput): Promise<TurnOut> {
  const [row] = await q<any>("SELECT * FROM sessions WHERE id=$1 AND device_id=$2", [sessionId, deviceId]);
  if (!row) throw new Error("session not found");
  const ctx: Ctx = { tried: [], helped: [], worse: [], recent: [], turns: 0, ...(row.ctx ?? {}) };
  let state: State = row.state;
  let flow: Flow = row.flow;
  const [pr] = await q<{ prefers: any }>("SELECT prefers FROM preferences WHERE device_id=$1", [deviceId]);
  const favorite: string | undefined = pr?.prefers?.favorite_exercise;
  let say: Seg[] = [];
  const ui: TurnOut["ui"] = {};
  let ended = false;
  let lead = -1; // how many leading non-exercise segments are in `say`
  let exBase = 0; // index in the exercise of the first exercise segment in `say`

  const text = input.text?.trim() || "";
  if (text) { ctx.recent.push({ r: "u", t: text.slice(0, 300) }); ctx.turns++; }

  const pick = (f: Exclude<Flow, "unsure">) => {
    let order = BY_FLOW[f].filter((id) => !ctx.tried.includes(id) && !ctx.worse.includes(id));
    if (!order.length) { ctx.tried = []; order = BY_FLOW[f].filter((id) => !ctx.worse.includes(id)); }
    if (!order.length) order = BY_FLOW[f];
    return favorite && order.includes(favorite) ? favorite : order[0];
  };
  const begin = (leadSegs: Seg[] = []) => {
    const f = (flow === "unsure" ? "overwhelm" : flow) as Exclude<Flow, "unsure">;
    const id = pick(f); const ex = getExercise(id);
    ctx.exId = id; ctx.tried.push(id); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    say = [...leadSegs, ...ex.segments.map((s) => ({ ...s }))]; lead = leadSegs.length; exBase = 0;
  };
  const replayFrom = (idx: number, leadSegs: Seg[] = []) => {
    const ex = getExercise(ctx.exId!); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    const rest = ex.segments.slice(Math.max(0, idx));
    say = [...leadSegs, ...(rest.length ? rest : [S("We've reached the end of this one.", 800)])]; lead = leadSegs.length; exBase = Math.max(0, idx);
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
    else if (input.event === "start") {
      if (flow === "unsure") { ctx.pending = "flow"; say = [S("I'm here with you.", 700), S("What's it like right now? You can say panic, a thought that won't leave, or that it's all a lot.", 400, true)]; }
      else begin([S("I'm here with you. We'll go slowly.", 700)]);
    } else if (input.event === "okay_now") finish();
    else if (input.event === "resume") { if (ctx.exId) replayFrom((input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1)); else begin(); }
    else if (input.event === "segments_done") {
      if (state === "support") { state = "adapt"; ctx.pending = "continue"; say = [S("Would you like to keep going, or stop here?", 400, true)]; }
    } else if (text) {
      const i = intent(text);
      const resumeAt = (input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1);
      if (ctx.pending === "flow") {
        const f = detectFlow(text) ?? (await gemini<{ flow: string }>(`Which best fits? panic, intrusive (unwanted repeating thoughts), or overwhelm. Text: "${text.slice(0, 300)}". JSON {"flow":"..."}`, true, { timeoutMs: 3000 }))?.flow;
        flow = (["panic", "intrusive", "overwhelm"].includes(f as string) ? f : "overwhelm") as Flow;
        begin([S("Thank you. Let's do this together.", 600)]);
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
        const ex = ctx.exId ? getExercise(ctx.exId) : null;
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
  const ex = ctx.exId ? getExercise(ctx.exId) : null;
  await q(
    `UPDATE sessions SET state=$2, ctx=$3, flow=$4, helpful_exercise_ids=$5, ended_at=CASE WHEN $6 THEN now() ELSE ended_at END,
       summary=CASE WHEN $6 THEN $7 ELSE summary END WHERE id=$1`,
    [sessionId, state, JSON.stringify(ctx), flow, ctx.helped, ended, `${flow}; tried ${ctx.tried.join(", ") || "none"}; helped ${ctx.helped.join(", ") || "none"}`]);

  if (lead < 0) lead = say.length;
  return { say: out(say, ctx.slow), lead, exBase, state, flow, exerciseId: ctx.exId, exerciseTitle: ex?.title, ui };
}
