import { q } from "./db";
import { gemini } from "./gemini";
import { assessSafety, CRISIS_SEGS, MEDICAL_SEGS, SAFETY_QUESTION } from "./safety";
import { BY_FLOW, EXERCISES, Flow as ExerciseFlow, getExercise } from "./exercises";
import { out, OutSeg, Seg } from "./speech";
import { listSourced, slug } from "./techniques";

/**
 * A DIRECTIVE guide, not a chatbot. In the moment it tells her what to do, one short step at a time, and moves from one
 * technique to the next on its own. It does not ask what she wants and does not wait for answers. She can interrupt
 * ("slower", "something else", "stop") but never has to. The only question it ever asks is a safety question, and only
 * when she herself mentions a symptom that could be an emergency. See docs/EVIDENCE.md.
 */
type Flow = ExerciseFlow | "checkin" | "talk";
export type State = "start" | "support" | "adapt" | "finish" | "followup" | "crisis";
type Pending = "safety" | "finish_choice" | "checkin" | "checkin_reply";
type Ctx = {
  exId?: string; checkinId?: string; sit?: string; rkey?: string; rcount?: number; blocks?: number;
  tried: string[]; helped: string[]; worse: string[]; slow?: boolean; pending?: Pending;
  resumeIdx?: number; recent: { r: "u" | "a"; t: string }[]; turns: number;
};
export type TurnInput = {
  event?: "start" | "segments_done" | "okay_now" | "resume" | "help_now" | "safe_now" | "choose"; exId?: string; text?: string; spoken_idx?: number; interrupted?: boolean;
};
export type TurnOut = {
  say: OutSeg[]; lead: number; exBase: number; state: State; flow: Flow; exerciseId?: string; exerciseTitle?: string; research?: { key: string; flow: string; sit: string };
  catalog: { id: string; title: string; blurb: string; source?: string }[]; transitions: OutSeg[]; progress: { block: number; max: number };
  ui: { crisis?: "self_harm" | "medical"; finish?: boolean; followup?: boolean; trusted?: boolean; checkinConsent?: boolean; suggestCare?: boolean; done?: boolean; rate?: boolean; source?: { name: string; url: string; title: string } };
};

const MAX_BLOCKS = 8; // about 12 to 15 minutes of guidance, then a closing
const norm = (t: string) => t.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
const S = (text: string, pause_ms = 800, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });
const TRANSITIONS = ["Good. Stay with me.", "Well done. Next step.", "Keep going. You're doing this.", "Good. Let's keep moving.", "That's it. Next."];
const FLOW_LABEL: Record<string, string> = { panic: "panic attack", overwhelm: "feeling overwhelmed", talk: "anxiety" };

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
const FREE_SYSTEM = (flow: string) => `You speak aloud to someone who is distressed, like a calm, steady therapist. Reply with ONE short sentence (max 15 words) that acknowledges what they said. Never ask a question. Never diagnose. Never promise they will be okay or that something will or won't happen. Never say "don't worry", "you're fine", or "calm down". ${flow === "intrusive" ? "They are having intrusive thoughts: do NOT analyze, discuss, or reassure about the content of the thought (reassurance can reinforce the pattern). Acknowledge the distress only." : ""} Reply JSON {"say":"..."}.`;

async function freeTalk(flow: string, text: string, recent: Ctx["recent"]): Promise<string> {
  const hist = recent.slice(-4).map((m) => `${m.r === "u" ? "Person" : "You"}: ${m.t}`).join("\n");
  const g = await gemini<{ say: string }>(`${hist}\nPerson: ${text.slice(0, 400)}`, true, { system: FREE_SYSTEM(flow), timeoutMs: 4000 });
  const say = g?.say?.trim();
  if (!say || BANNED.test(say) || say.includes("?") || say.split(/\s+/).length > 25) return "I hear you. Stay with me.";
  return say;
}
async function situationOf(text: string): Promise<string | null> {
  if (text.split(/\s+/).length < 6) return null;
  const g = await gemini<{ situation: string }>(`Summarize what this person is going through as a short neutral phrase (max 6 words, no diagnosis, e.g. "panic attack at work"): "${text.slice(0, 300)}". JSON {"situation":"..."}`, true, { timeoutMs: 2500 });
  return g?.situation?.trim().toLowerCase().slice(0, 60) || null;
}

/** Conversational reply for "just talk to me" mode. Warm, human, short. May include a gentle invitation, never a diagnosis or a promise. */
async function talkReply(text: string, recent: Ctx["recent"]): Promise<string> {
  const hist = recent.slice(-6).map((m) => `${m.r === "u" ? "Person" : "You"}: ${m.t}`).join("\n");
  const g = await gemini<{ say: string }>(`${hist}\nPerson: ${text.slice(0, 500)}`, true, {
    system: `You are a warm, steady friend with the skills of a good therapist, talking out loud to someone who is anxious. Sound like a real person: contractions, plain words, no lists, no jargon. Reply in 2 to 3 short sentences. Respond to the specific thing they said. You may end with one gentle invitation such as "If you want, we can breathe together." Never diagnose. Never promise they will be okay. Never say "calm down" or "don't worry". Reply JSON {"say":"..."}`,
    timeoutMs: 5000 });
  const say = g?.say?.trim();
  if (!say || BANNED.test(say) || say.split(/\s+/).length > 60) return "I hear you. I'm right here with you. Tell me more, or we can just breathe for a minute.";
  return say;
}

/** Researched steps come from web pages: have Gemini say them like a person. Same steps, same count, same meaning. Falls back to the originals. */
async function humanize(segs: Seg[], sit: string | undefined): Promise<Seg[]> {
  const g = await gemini<{ lines: string[] }>(
    `Rewrite each line so a calm, warm person would say it out loud to someone who is anxious${sit ? ` (${sit})` : ""}. Keep the exact same instruction and the same number of lines. Short, spoken, contractions. No questions. No promises. No "relax" or "calm down". Lines:\n${JSON.stringify(segs.map((x) => x.text))}\nReply JSON {"lines":[...]}`,
    true, { timeoutMs: 6000 });
  const lines = g?.lines;
  if (!Array.isArray(lines) || lines.length !== segs.length) return segs;
  if (lines.some((l) => typeof l !== "string" || !l.trim() || l.length > 150 || l.includes("?") || BANNED.test(l))) return segs;
  return segs.map((x, i) => ({ ...x, text: lines[i].trim() }));
}

const ACKS = ["Good.", "That's it.", "Nicely done.", "Stay with that."];

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

  // Techniques Bright Data researched for her situation (never for intrusive thoughts: reviewed exercises only).
  const sourced = ctx.rkey && flow !== "intrusive" ? await listSourced(ctx.rkey) : [];
  const exMap = new Map<string, any>(sourced.map((e) => [e.id, e]));
  const getEx = (id: string): any => exMap.get(id) ?? getExercise(id);
  let research: TurnOut["research"];
  const startResearch = (sit: string, force = false) => {
    if (flow === "intrusive" || flow === "checkin") return;
    if (ctx.rkey && !force) return;
    if ((ctx.rcount ?? 0) >= 2) return;
    const f = flow === "overwhelm" ? "overwhelm" : "panic";
    const key = `${f}:${slug(sit)}`;
    if (key === ctx.rkey) return;
    ctx.sit = sit; ctx.rkey = key; ctx.rcount = (ctx.rcount ?? 0) + 1; research = { key, flow: f, sit };
  };

  const text = input.text?.trim() || "";
  if (text) { ctx.recent.push({ r: "u", t: text.slice(0, 300) }); ctx.turns++; }

  let forced: string | undefined;
  const seqFlow = (): Exclude<ExerciseFlow, "unsure"> => (flow === "overwhelm" ? "overwhelm" : flow === "intrusive" ? "intrusive" : "panic");
  /** Next block in the arc. Researched techniques are woven in after the first two reviewed ones. */
  const pick = () => {
    if (forced) return forced;
    const seq = BY_FLOW[seqFlow()], srcIds = sourced.map((e) => e.id);
    const unseen = (ids: string[]) => ids.filter((id) => !ctx.tried.includes(id) && !ctx.worse.includes(id));
    const wantSourced = ctx.tried.length >= 2 && ctx.tried.length % 2 === 0;
    let next = wantSourced ? unseen(srcIds)[0] ?? unseen(seq)[0] : unseen(seq)[0] ?? unseen(srcIds)[0];
    if (!next) { ctx.tried = []; next = seq.filter((id) => !ctx.worse.includes(id))[0] ?? seq[0]; }
    return next;
  };
  const begin = (leadSegs: Seg[] = []) => {
    const id = pick(); const ex = getEx(id);
    ctx.exId = id; ctx.tried.push(id); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    const l = id.startsWith("src:") ? [...leadSegs, S(`Here's an approach from ${ex.source_name}.`, 500)] : leadSegs;
    say = [...l, ...ex.segments.map((s: Seg) => ({ ...s }))]; lead = l.length; exBase = 0;
  };
  const replayFrom = (idx: number, leadSegs: Seg[] = []) => {
    const ex = getEx(ctx.exId!); ctx.pending = undefined; ctx.resumeIdx = undefined; state = "support";
    const rest = ex.segments.slice(Math.max(0, idx));
    if (!rest.length) { ctx.blocks = (ctx.blocks ?? 0) + 1; begin(leadSegs); return; }
    say = [...leadSegs, ...rest]; lead = leadSegs.length; exBase = Math.max(0, idx);
  };
  const crisis = (kind: "self_harm" | "medical") => {
    state = "crisis"; ui.crisis = kind; ctx.pending = undefined;
    say = (kind === "medical" ? MEDICAL_SEGS : CRISIS_SEGS).map((s) => ({ ...s }));
  };
  /** Closing is a statement, not a question. Options appear as buttons. */
  const finish = async () => {
    state = "finish"; ctx.pending = "finish_choice"; ui.finish = true; ui.followup = true; ended = true;
    const [r] = await q<{ n: number }>("SELECT count(*)::int n FROM sessions WHERE device_id=$1 AND started_at > now() - interval '14 days'", [deviceId]);
    ui.suggestCare = (r?.n ?? 0) >= 2;
    say = [
      S("You've done well. Stay here a little longer.", 1200),
      S("Keep your feet on the floor, and keep your breathing slow.", 2000),
      S("When you're ready, drink some water.", 2000),
      S("If this has lasted much longer than twenty minutes, or you have chest pain, call 911. If you feel unsafe, call or text 988.", 800),
    ];
  };

  // ---------------- 1. SAFETY FIRST: every utterance, before anything else ----------------
  let handled = false;
  if (text && state !== "crisis") {
    if (ctx.pending === "safety") {
      ctx.pending = undefined;
      const i = intent(text);
      if (i === "yes" || /\b(yes|yeah|a little|i think so|maybe)\b/.test(norm(text))) { crisis("medical"); handled = true; }
      else if (i === "no") { const l = [S("Thank you for telling me. We'll keep going, gently.", 800)]; if (ctx.exId) replayFrom(ctx.resumeIdx ?? 0, l); else begin(l); handled = true; }
    }
    if (!handled) {
      const level = await assessSafety(text);
      if (level === "crisis") { crisis("self_harm"); handled = true; }
      else if (level === "medical") { crisis("medical"); handled = true; }
      else if (level === "uncertain") {
        // The one question this app asks. Only because she mentioned a symptom that could be an emergency.
        ctx.pending = "safety"; ctx.resumeIdx = (input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1);
        say = SAFETY_QUESTION.map((s) => ({ ...s })); handled = true;
      }
    }
  }

  // ---------------- 2. state machine ----------------
  if (!handled) {
    if (state === "crisis") {
      if (input.event === "safe_now") {
        // Back to guiding. No question.
        begin([S("I'm glad you're safe right now. Stay with me. We'll go slowly.", 800)]);
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
    } else if (input.event === "choose") {
      const id = input.exId ?? "";
      if (EXERCISES.some((e) => e.id === id) || exMap.has(id)) { forced = id; ctx.worse = ctx.worse.filter((x) => x !== id); begin([S("Okay. Let's do this one.", 400)]); }
    } else if (input.event === "start" && flow === "talk") {
      ctx.pending = undefined; state = "start";
      say = [S("Hey. I'm right here.", 500), S("Tell me what's going on. Or if you'd rather not talk, just stay with me and we'll breathe.", 400, true)];
    } else if (input.event === "start") {
      // Straight into guidance. No greeting, no questions: the first block opens with "I'm here. Do exactly what I say."
      startResearch(FLOW_LABEL[flow] ?? "anxiety attack");
      begin();
    } else if (input.event === "okay_now") await finish();
    else if (input.event === "resume") { if (ctx.exId) replayFrom((input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1)); else begin(); }
    else if (input.event === "segments_done") {
      // The block ended. Move to the next one on our own.
      if (state === "support") {
        ctx.blocks = (ctx.blocks ?? 0) + 1;
        if (ctx.blocks >= MAX_BLOCKS) await finish();
        else begin();
      }
    } else if (text) {
      const i = intent(text);
      const resumeAt = (input.spoken_idx ?? -1) + (input.interrupted ? 0 : 1);
      if (flow === "talk" && ctx.pending !== "finish_choice" && i !== "stop") {
        const f = detectFlow(text);
        const wantsGuide = /(breathe|breathing|guide me|help me calm|help me through|walk me through|exercise)/.test(norm(text)) || i === "yes";
        if (wantsGuide || ((f === "panic" || f === "overwhelm") && /(panic|attack|can't breathe|racing|spiral|freaking|losing it|overwhelm)/.test(norm(text)))) {
          flow = f === "overwhelm" ? "overwhelm" : "panic"; startResearch(FLOW_LABEL[flow] ?? "anxiety");
          begin([S("Okay. Let's slow this down together.", 500)]);
        } else {
          const reply = await talkReply(text, ctx.recent); ctx.recent.push({ r: "a", t: reply });
          const sit = await situationOf(text); if (sit && f !== "intrusive") { flow = "talk"; startResearch(sit); }
          say = [S(reply, 600, true)]; state = "start";
        }
      } else if (ctx.pending === "checkin_reply") {
        const n = norm(text);
        const neg = /(not good|not great|not okay|not ok|bad|anxious|rough|hard|worse|tough|stress|panic|scared|overwhelm|struggl|tired|awful|terrible|can't|cant)/.test(n);
        const pos = /\b(good|fine|okay|ok|better|great|well|alright|calm)\b/.test(n);
        if (neg) { flow = detectFlow(text) ?? "overwhelm"; startResearch(FLOW_LABEL[flow] ?? "feeling overwhelmed"); begin([S("Thank you for telling me. Let's do this together. Follow my voice.", 700)]); }
        else if (pos) { ctx.pending = undefined; ui.done = true; say = [S("I'm glad to hear that. I'm here whenever you need me.", 500)]; }
        else { const reply = await freeTalk("overwhelm", text, ctx.recent); startResearch("feeling overwhelmed"); begin([S(reply, 600), S("Follow my voice. We'll take this slowly.", 600)]); }
      } else if (ctx.pending === "finish_choice") {
        if (i === "trusted") { ui.trusted = true; say = [S("A message is ready on your screen. You choose who gets it.", 500)]; }
        else if (i === "yes" || i === "talk" || i === "different") { ctx.blocks = 0; ctx.tried = ctx.tried.filter((x) => x !== ctx.exId); begin([S("Okay. Let's continue. Follow my voice.", 600)]); }
        else { ui.done = true; say = [S("Take care of yourself. I'm here whenever you need me.", 500)]; ctx.pending = undefined; ended = true; }
      } else if (i === "stop") await finish();
      else if (i === "trusted") { ui.trusted = true; say = [S("A message is ready on your screen. You choose who gets it.", 500)]; }
      else if (i === "slower") { ctx.slow = true; if (ctx.exId) replayFrom(resumeAt, [S("Okay. Slower.", 600)]); else begin([S("Okay. Slower.", 600)]); }
      else if (i === "worse") { if (ctx.exId) ctx.worse.push(ctx.exId); begin([S("Okay. Let's change it. Follow my voice.", 600)]); }
      else if (i === "different") begin([S("Okay. Let's change it. Follow my voice.", 600)]);
      else if (i === "helped") { if (ctx.exId && !ctx.helped.includes(ctx.exId)) ctx.helped.push(ctx.exId); if (ctx.exId) replayFrom(resumeAt, [S("Good. Stay with it.", 500)]); else begin(); }
      else if (i === "pause") say = [];
      else {
        // She said something. Acknowledge in one sentence, then keep guiding from exactly where we were. No questions.
        const ex = ctx.exId ? getEx(ctx.exId) : null;
        const cur = ex && input.spoken_idx != null ? ex.segments[input.spoken_idx] : null;
        const short = text.split(/\s+/).length <= 8;
        const seeksReassurance = flow === "intrusive" && /(am i|will i|is it|what if|do you think|are you sure|promise|tell me).*(okay|ok|fine|safe|happen|true|real|bad|wrong|crazy|dangerous)/.test(norm(text));
        if (seeksReassurance) {
          const l = [S("I can't know that, and chasing the answer won't help right now. Let the question stay open.", 900)];
          if (ex) replayFrom(resumeAt, l); else begin(l);
        } else if (ex && cur?.listen && short && state === "support") replayFrom(input.spoken_idx! + 1, [S(ACKS[ctx.turns % ACKS.length], 500)]);
        else {
          const [reply, sit] = await Promise.all([freeTalk(flow, text, ctx.recent), situationOf(text)]);
          if (sit) startResearch(sit, true);
          ctx.recent.push({ r: "a", t: reply });
          const l = [S(reply, 600)];
          if (ex) replayFrom(resumeAt, l); else begin(l);
        }
      }
    }
  }

  // ---------------- 3. persist (no transcripts: recent turns are purged when the session ends) ----------------
  if (ended || state === "followup" || ui.done) ctx.recent = [];
  if (say.length && say[0]) ctx.recent.push({ r: "a", t: say.map((s) => s.text).join(" ").slice(0, 200) });
  ctx.recent = ctx.recent.slice(-6);
  if (ended || ui.done) ctx.recent = [];
  // Researched blocks are machine-extracted: have Gemini say them like a person (never the reviewed ones, which are already written to be spoken).
  if (ctx.exId?.startsWith("src:") && !ui.crisis && say.length > Math.max(lead, 0)) {
    const l0 = Math.max(lead, 0);
    say = [...say.slice(0, l0), ...(await humanize(say.slice(l0), ctx.sit))];
  }
  const ex = ctx.exId ? getEx(ctx.exId) : null;
  if (ex?.source_url) ui.source = { name: ex.source_name, url: ex.source_url, title: ex.title };
  await q(
    `UPDATE sessions SET state=$2, ctx=$3, flow=$4, helpful_exercise_ids=$5, ended_at=CASE WHEN $6 THEN now() ELSE ended_at END,
       summary=CASE WHEN $6 THEN $7 ELSE summary END WHERE id=$1`,
    [sessionId, state, JSON.stringify(ctx), flow, ctx.helped, ended, `${flow}; tried ${ctx.tried.join(", ") || "none"}; helped ${ctx.helped.join(", ") || "none"}`]);

  if (lead < 0) lead = say.length;
  const sf = seqFlow();
  const catalog = [
    ...EXERCISES.filter((e) => e.flows.includes(sf) || e.id === "exhale-breath").map((e) => ({ id: e.id, title: e.title, blurb: e.blurb })),
    ...sourced.map((e) => ({ id: e.id, title: e.title, blurb: `From ${e.source_name}`, source: e.source_name })),
  ];
  return {
    say: out(say, ctx.slow), lead, exBase, state, flow: flow as any, exerciseId: ctx.exId, exerciseTitle: ex?.title, ui, research,
    catalog, transitions: out(TRANSITIONS.map((t) => S(t, 0))), progress: { block: ctx.blocks ?? 0, max: MAX_BLOCKS },
  };
}
