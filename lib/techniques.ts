import { q } from "./db";
import { gemini } from "./gemini";
import { brightEnabled, serpLinks, unlock } from "./brightdata";
import type { Exercise } from "./exercises";

/**
 * Live research: Bright Data finds and reads public pages from well-known health sources, Gemini turns them into short spoken
 * self-guided steps, Neon stores them with the source. Never blocks the first seconds of a session (runs in the background).
 */
const SOURCES: Record<string, string> = {
  "nhs.uk": "the NHS", "nimh.nih.gov": "the National Institute of Mental Health", "mayoclinic.org": "Mayo Clinic", "adaa.org": "the Anxiety and Depression Association of America",
  "anxiety.org": "Anxiety.org", "iocdf.org": "the International OCD Foundation", "nami.org": "NAMI", "cdc.gov": "the CDC", "medlineplus.gov": "MedlinePlus",
  "health.harvard.edu": "Harvard Health", "apa.org": "the American Psychological Association", "mind.org.uk": "Mind", "helpguide.org": "HelpGuide",
  "clevelandclinic.org": "Cleveland Clinic", "hopkinsmedicine.org": "Johns Hopkins Medicine", "va.gov": "the VA", "samhsa.gov": "SAMHSA", "mentalhealth.org.uk": "the Mental Health Foundation",
};
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sourceFor = (u: string) => { const h = hostOf(u); const k = Object.keys(SOURCES).find((d) => h === d || h.endsWith("." + d)); return k ? { host: k, name: SOURCES[k] } : null; };
const SITE_BIAS = "(site:nhs.uk OR site:nimh.nih.gov OR site:mayoclinic.org OR site:adaa.org OR site:clevelandclinic.org OR site:helpguide.org OR site:anxiety.org OR site:health.harvard.edu)";

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join("-");

const SYSTEM = `You turn ONE public health web page into short, self-guided calming techniques that a person can follow by listening, for someone who is distressed right now.
Return JSON {"techniques":[{"title":string,"duration_s":number,"why":string,"anchors":[string],"steps":[{"text":string,"pause_ms":number,"listen":boolean}],"quote":string}]}.
RULES: Use ONLY techniques the page itself describes (breathing, grounding, muscle relaxation, orienting, etc). At most 3 techniques. Each has 5 to 9 steps. Each step is ONE short spoken sentence (max 14 words), second person, calm, no jargon. Write DIRECT INSTRUCTIONS that say exactly what to do with the body or attention (imperative: "Put your feet on the floor." "Breathe in through your nose for four."). Include concrete counts or durations where the page gives them. Never write a statement about what they are doing, like "You are noticing your breath". NEVER write a question and never ask the person to choose or answer anything.
pause_ms is the silence after the step (1500 to 7000; longer when the person has to do something). listen=true only when the person is asked to name or say something.
Do NOT include medication, doses, diagnosis, promises that it will stop or cure anything, or techniques that need a clinician. Do NOT include "calm down" or "relax". If the page has no such technique return {"techniques":[]}. quote = a short phrase (max 140 chars) copied from the page. why = 1 to 2 plain sentences explaining why this technique helps, using ONLY what the page says (no new medical claims, no promises). anchors = exactly 3 short physical or room cues from the steps (max 8 words each), like "Both feet flat on the floor".`;

const BAD_STEP = /(medicat|\bdose\b|\bmg\b|diagnos|prescri|\bcure\b|guarantee|will (stop|go away|disappear)|calm down|just relax|don'?t worry|you'?re fine)/i;

type Raw = { why?: string; anchors?: string[]; title?: string; duration_s?: number; steps?: { text?: string; pause_ms?: number; listen?: boolean }[]; quote?: string };

function clean(t: Raw) {
  if (!t.title || !Array.isArray(t.steps)) return null;
  const steps = t.steps.map((s) => ({ text: String(s.text ?? "").trim().slice(0, 130), pause_ms: Math.max(1200, Math.min(8000, Number(s.pause_ms) || 2500)), ...(s.listen ? { listen: true } : {}) })).filter((s) => s.text);
  if (steps.length < 4 || steps.length > 10 || steps.some((s) => BAD_STEP.test(s.text) || s.text.includes("?"))) return null;
  return { why: t.why ? String(t.why).slice(0, 320) : null, anchors: Array.isArray(t.anchors) ? t.anchors.map((a) => String(a).slice(0, 60)).slice(0, 3) : [], title: String(t.title).slice(0, 80), duration_s: Math.round(Number(t.duration_s) || steps.reduce((a, s) => a + s.pause_ms / 1000 + 3, 0)), steps, quote: t.quote ? String(t.quote).slice(0, 160) : null };
}

async function setStatus(sessionId: string | null, status: string) { if (!sessionId) return; await q("UPDATE sessions SET research=$2 WHERE id=$1", [sessionId, status]).catch(() => {}); }

export async function researchTechniques(key: string, flow: string, sit: string, sessionId: string | null): Promise<void> {
  try {
    if (!brightEnabled()) return void (await setStatus(sessionId, "unavailable"));
    const [fresh] = await q<{ n: number }>("SELECT count(*)::int n FROM techniques WHERE situation_key=$1 AND checked_at > now() - interval '24 hours'", [key]);
    if (fresh.n > 0) return void (await setStatus(sessionId, "done"));

    const base = flow === "panic" ? "panic attack" : "feeling overwhelmed";
    const queries = [
      `${sit} grounding breathing techniques to calm down ${SITE_BIAS}`,
      `how to cope with ${sit === base ? base : sit + " " + base} right now self-help steps ${SITE_BIAS}`,
    ];
    const hits = (await Promise.all(queries.map((qq) => serpLinks(qq, 5).catch(() => [])))).flat();
    const urls: string[] = [];
    for (const h of hits) if (sourceFor(h.url) && !urls.includes(h.url)) urls.push(h.url);
    let saved = 0;
    const queue = urls.slice(0, 5);
    const worker = async () => {
      while (queue.length) {
        const u = queue.shift()!; const src = sourceFor(u)!;
        try {
          const text = await unlock(u, 12000);
          if (text.length < 300) continue;
          const g = await gemini<{ techniques?: Raw[] }>(`SITUATION: ${sit}\nPAGE: ${u}\n\n${text}`, true, { system: SYSTEM, timeoutMs: 30000 });
          for (const raw of g?.techniques ?? []) {
            const t = clean(raw); if (!t) continue;
            await q(
              `INSERT INTO techniques(situation_key, flow, title, steps, duration_s, source_url, source_name, quote, why, anchors) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (situation_key, source_url, title) DO UPDATE SET steps=$4, duration_s=$5, quote=$8, why=$9, anchors=$10, checked_at=now()`,
              [key, flow, t.title, JSON.stringify(t.steps), t.duration_s, u, src.name, t.quote, t.why, JSON.stringify(t.anchors)]);
            saved++;
          }
        } catch (e) { console.error("technique page failed", hostOf(u), (e as Error).message); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await setStatus(sessionId, saved ? "done" : "none");
  } catch (e) { console.error("research failed", (e as Error).message); await setStatus(sessionId, "failed"); }
}

export type Sourced = Exercise & { source_url: string; source_name: string; db_id: string; why: string | null; anchors: string[] };

export async function listSourced(key: string): Promise<Sourced[]> {
  const rows = await q<any>("SELECT * FROM techniques WHERE situation_key=$1 ORDER BY checked_at DESC LIMIT 8", [key]);
  return rows.map((r) => ({
    id: `src:${r.id}`, db_id: r.id, title: r.title, blurb: `From ${r.source_name}`, flows: [r.flow], status: "needs human review" as const, source_url: r.source_url, source_name: r.source_name, why: r.why ?? null, anchors: (r.anchors as string[]) ?? [],
    segments: [{ text: "Do exactly what I say, one step at a time.", pause_ms: 1500 }, ...(r.steps as any[])].map((s) => ({ text: s.text, pause_ms: s.pause_ms, ...(s.listen ? { listen: true } : {}) })),
  }));
}
