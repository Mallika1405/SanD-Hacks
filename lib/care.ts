import { q } from "./db";
import { gemini } from "./gemini";
import { brightEnabled, serpLinks, unlock } from "./brightdata";

/* ---------------------------------------------------------------- discovery (Bright Data -> Gemini -> Neon) */

const SKIP_HOSTS = /(youtube|facebook|instagram|reddit|twitter|x\.com|tiktok|pinterest|linkedin|yelp|wikipedia|amazon)\./i;
const queriesFor = (city: string) => [
  `therapist panic disorder anxiety CBT ${city}`,
  `OCD ERP exposure response prevention therapist ${city}`,
  `anxiety support group ${city}`,
  `OCD support group ${city}`,
  `NAMI ${city} support groups`,
  `sliding scale low cost therapy ${city}`,
  `community mental health clinic ${city} low cost anxiety`,
  `free online anxiety panic support group`,
];

const EXTRACT_SYSTEM = `You extract mental-health care listings from ONE public web page. Return JSON {"providers":[...],"groups":[...]}.
RULES: Use ONLY facts stated on the page. If a field is not stated use null (or [] for lists). NEVER guess insurance participation, price, availability or whether they are accepting clients: copy the page's own wording into insurance_text / cost_text / availability_text, otherwise null. Do not diagnose or recommend. At most 8 providers and 8 groups.
A provider is a therapist, practice, clinic, program or directory that people can contact. A group is a support or peer group (in person or online).
provider = {"name","kind":"therapist"|"clinic"|"low_cost"|"directory","specialties":[string],"modalities":[string],"location":string|null,"telehealth":boolean|null,"url":string|null,"insurance_text":string|null,"cost_text":string|null,"availability_text":string|null,"notes":string|null,"quote":string}
group = {"name","kind":"support_group"|"peer","topics":[string],"format":"online"|"in_person"|"hybrid"|null,"schedule_text":string|null,"cost_text":string|null,"url":string|null,"notes":string|null,"quote":string}
notes = languages, populations served or stated therapist gender if stated. quote = a short phrase (max 160 chars) copied from the page that supports the listing.`;

type Extracted = { providers?: any[]; groups?: any[] };
const abs = (u: any, base: string) => { try { return u ? new URL(String(u), base).toString() : null; } catch { return null; } };
const arr = (v: any) => (Array.isArray(v) ? v.map(String).slice(0, 8) : []);
const str = (v: any, n = 300) => (v == null || v === "" ? null : String(v).slice(0, n));

export async function ingestPage(pageUrl: string): Promise<{ providers: number; groups: number }> {
  const text = await unlock(pageUrl);
  if (text.length < 200) return { providers: 0, groups: 0 };
  const ex = await gemini<Extracted>(`PAGE URL: ${pageUrl}\n\nPAGE TEXT:\n${text}`, true, { system: EXTRACT_SYSTEM, timeoutMs: 40000 });
  if (!ex) return { providers: 0, groups: 0 };
  let p = 0, g = 0;
  for (const x of (ex.providers ?? []).slice(0, 8)) {
    if (!x?.name) continue;
    const conf = Math.min(0.6, 0.3 + (x.location ? 0.1 : 0) + (x.url ? 0.1 : 0) + (x.quote ? 0.1 : 0));
    await q(
      `INSERT INTO providers(name,kind,specialties,modalities,location,telehealth,url,insurance_text,cost_text,availability_text,notes,quote,source_url,checked_at,verified,confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),false,$14)
       ON CONFLICT (source_url,name) DO UPDATE SET kind=$2,specialties=$3,modalities=$4,location=$5,telehealth=$6,url=$7,insurance_text=$8,cost_text=$9,availability_text=$10,notes=$11,quote=$12,checked_at=now(),confidence=$14`,
      [str(x.name, 160), ["therapist", "clinic", "low_cost", "directory"].includes(x.kind) ? x.kind : "therapist", arr(x.specialties), arr(x.modalities), str(x.location, 160),
        typeof x.telehealth === "boolean" ? x.telehealth : null, abs(x.url, pageUrl), str(x.insurance_text), str(x.cost_text), str(x.availability_text), str(x.notes), str(x.quote, 200), pageUrl, conf]);
    p++;
  }
  for (const x of (ex.groups ?? []).slice(0, 8)) {
    if (!x?.name) continue;
    const conf = Math.min(0.6, 0.3 + (x.schedule_text ? 0.1 : 0) + (x.url ? 0.1 : 0) + (x.quote ? 0.1 : 0));
    await q(
      `INSERT INTO groups(name,kind,topics,format,schedule_text,cost_text,url,notes,quote,source_url,checked_at,verified,confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),false,$11)
       ON CONFLICT (source_url,name) DO UPDATE SET kind=$2,topics=$3,format=$4,schedule_text=$5,cost_text=$6,url=$7,notes=$8,quote=$9,checked_at=now(),confidence=$11`,
      [str(x.name, 160), x.kind === "peer" ? "peer" : "support_group", arr(x.topics), ["online", "in_person", "hybrid"].includes(x.format) ? x.format : null, str(x.schedule_text), str(x.cost_text),
        abs(x.url, pageUrl), str(x.notes), str(x.quote, 200), pageUrl, conf]);
    g++;
  }
  return { providers: p, groups: g };
}

/** Public-web discovery for one area. Skips pages checked in the last 12 hours. */
export async function discover(city: string, opts: { maxPages?: number; log?: (s: string) => void } = {}) {
  if (!brightEnabled()) throw new Error("Bright Data is not configured");
  const log = opts.log ?? (() => {});
  const urls = new Map<string, string>();
  for (const query of queriesFor(city)) {
    const hits = await serpLinks(query, 4);
    log(`"${query}" -> ${hits.length} results`);
    for (const h of hits) { try { const host = new URL(h.url).hostname; if (!SKIP_HOSTS.test(host)) urls.set(h.url, h.title); } catch {} }
  }
  const recent = new Set((await q<{ source_url: string }>(
    `SELECT source_url FROM providers WHERE checked_at > now() - interval '12 hours' UNION SELECT source_url FROM groups WHERE checked_at > now() - interval '12 hours'`)).map((r) => r.source_url));
  const todo = [...urls.keys()].filter((u) => !recent.has(u)).slice(0, opts.maxPages ?? 24);
  let providers = 0, groups = 0, ok = 0;
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.allSettled(todo.slice(i, i + 3).map(async (u) => {
      try { const r = await ingestPage(u); providers += r.providers; groups += r.groups; ok++; log(`${u.slice(0, 80)} -> ${r.providers}p ${r.groups}g`); }
      catch (e) { log(`${u.slice(0, 80)} -> failed (${(e as Error).message})`); }
    }));
  }
  return { searched: queriesFor(city).length, pages: todo.length, ok, providers, groups };
}

/* ---------------------------------------------------------------- matching (cache only) */

export type Answers = {
  city: string; goals: string[]; budget: "free" | "low" | "flexible"; insurance: string; language: string; gender: string; extras: string[]; format: "online" | "in_person" | "either";
};

const FALLBACK: Record<string, { name: string; why: string; terms: string[] }> = {
  panic: { name: "CBT-based care for panic and anxiety", why: "A common, well-studied approach for panic attacks.", terms: ["panic", "cbt", "cognitive", "anxiety"] },
  intrusive: { name: "Clinicians trained in ERP (exposure and response prevention)", why: "Often used for unwanted, repeating thoughts and the urge to check or seek reassurance.", terms: ["ocd", "erp", "exposure", "intrusive", "obsessive"] },
  overwhelm: { name: "Stress and anxiety skills support", why: "Therapy or skills groups that focus on coping with feeling overloaded.", terms: ["stress", "anxiety", "coping", "skills", "dbt", "mindfulness"] },
  low: { name: "Talking therapy for low mood", why: "General talk therapy can help when things feel heavy for a while.", terms: ["depression", "low mood", "talk therapy", "counseling"] },
  talk: { name: "Regular talk therapy or a peer support group", why: "Steady, ongoing support from a person or a group.", terms: ["counseling", "talk therapy", "support group", "peer"] },
};
const GOAL_KEY: Record<string, string> = { "Panic attacks": "panic", "Unwanted thoughts": "intrusive", "Feeling overwhelmed": "overwhelm", "Stress": "overwhelm", "Feeling low": "low", "Someone to talk to regularly": "talk" };

export async function suggest(answers: Answers, flows: string[]) {
  const keys = new Set<string>(answers.goals.map((g) => GOAL_KEY[g]).filter(Boolean));
  flows.forEach((f) => keys.add(f === "intrusive" ? "intrusive" : f === "panic" ? "panic" : "overwhelm"));
  if (!keys.size) keys.add("overwhelm");
  const base = [...keys].map((k) => FALLBACK[k]).filter(Boolean);
  const g = await gemini<{ specialties: { name: string; why: string; terms: string[] }[] }>(
    `Someone is exploring professional support. Goals: ${answers.goals.join(", ") || "not stated"}. Past in-the-moment experiences: ${flows.join(", ") || "not stated"}.
List up to 4 KINDS of care or specialties worth exploring (e.g. "CBT for panic", "ERP-trained clinician", "support group"). Do NOT diagnose or imply a diagnosis. Use cautious wording like "often used for". Give 3-6 lowercase search terms for each that might appear on a provider's page. JSON {"specialties":[{"name","why","terms":[]}]}`,
    true, { timeoutMs: 6000 });
  const specs = g?.specialties?.length ? g.specialties.slice(0, 4).map((s) => ({ name: String(s.name).slice(0, 90), why: String(s.why).slice(0, 160), terms: (s.terms ?? []).map((t) => String(t).toLowerCase()).slice(0, 6) })) : base;
  return specs;
}

const hay = (...p: (string | string[] | null | undefined)[]) => p.flat().filter(Boolean).join(" ").toLowerCase();

type Spec = { name: string; why: string; terms: string[] };

/** DB-only ranking (fast). Called repeatedly while live discovery streams in new pages. */
export async function rank(answers: Answers, specialties: Spec[]) {
  const terms = [...new Set(specialties.flatMap((s) => s.terms))];
  const city = answers.city.toLowerCase().split(",")[0].trim();
  const prov = await q<any>("SELECT * FROM providers ORDER BY checked_at DESC LIMIT 400");
  const grp = await q<any>("SELECT * FROM groups ORDER BY checked_at DESC LIMIT 400");
  const budgetHit = (t: string) => (answers.budget === "free" ? /\b(free|no cost|no charge)\b/.test(t) : answers.budget === "low" ? /(sliding|free|low[- ]cost|reduced|\$\s?[1-9]\d?\b|medi-?cal|medicaid)/.test(t) : false);
  const prefHit = (t: string) => (answers.language && answers.language !== "English" && t.includes(answers.language.toLowerCase()) ? 1 : 0) +
    (answers.gender && answers.gender !== "No preference" && new RegExp(`\\b${answers.gender.toLowerCase()}\\b`).test(t) ? 1 : 0) +
    answers.extras.filter((e) => t.includes(e.toLowerCase().split(" ")[0])).length;

  const providers = prov.map((p: any) => {
    const t = hay(p.name, p.specialties, p.modalities, p.notes, p.quote);
    const loc = hay(p.location, p.source_url, p.name);
    const specHits = terms.filter((x) => t.includes(x)).length;
    const online = p.telehealth === true;
    let sc = specHits * 3 + prefHit(t) + (loc.includes(city) ? 2 : 0) + (answers.format !== "in_person" && online ? 1.5 : 0) + (budgetHit(hay(p.cost_text, p.kind)) || p.kind === "low_cost" ? (answers.budget === "flexible" ? 0 : 2) : 0);
    if (answers.format === "online" && !online && p.telehealth === false) sc -= 2;
    return { p, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8).map((x) => x.p);

  const groups = grp.map((g: any) => {
    const t = hay(g.name, g.topics, g.notes, g.quote);
    const specHits = terms.filter((x) => t.includes(x)).length;
    const loc = hay(g.source_url, g.name, g.schedule_text, g.notes);
    let sc = specHits * 3 + (loc.includes(city) ? 2 : 0) + (g.format === "online" || g.format === "hybrid" ? 1 : 0) + (budgetHit(hay(g.cost_text)) ? 2 : 0) + prefHit(t);
    if (answers.format === "online" && g.format === "in_person") sc -= 2;
    return { g, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8).map((x) => x.g);

  const [stat] = await q<{ n: number; last: string }>(`SELECT (SELECT count(*) FROM providers)::int + (SELECT count(*) FROM groups)::int AS n,
    GREATEST((SELECT max(checked_at) FROM providers), (SELECT max(checked_at) FROM groups)) AS last`);
  return { providers, groups, directory: { listings: stat?.n ?? 0, last_checked: stat?.last ?? null } };
}

export async function search(answers: Answers, flows: string[]) {
  const specialties = await suggest(answers, flows);
  return { specialties, ...(await rank(answers, specialties)) };
}

/** Queries built from HER answers, not a fixed list. */
export function liveQueries(a: Answers, specs: Spec[]): string[] {
  const city = a.city || "San Diego, CA";
  const top = specs.slice(0, 2).map((s) => s.name.replace(/\(.*?\)/g, "").trim());
  const qs: string[] = [];
  for (const t of top) qs.push(`${t} therapist ${a.format === "online" ? "online telehealth California" : city}`);
  const goalWords = a.goals.length ? a.goals.slice(0, 2).map((g) => g.toLowerCase()) : ["anxiety"];
  for (const g of goalWords) qs.push(`${g} support group ${a.format === "online" ? "online" : city}`);
  if (a.budget !== "flexible" || /medi-?cal|medicaid|no insurance/i.test(a.insurance)) qs.push(`${a.budget === "free" ? "free" : "sliding scale low cost"} therapy ${a.format === "online" ? "online" : city} anxiety`);
  if (/medi-?cal|medicaid/i.test(a.insurance)) qs.push(`Medi-Cal accepted therapist ${city} anxiety`);
  if (a.extras.includes("LGBTQ+ affirming")) qs.push(`LGBTQ affirming therapist ${city} anxiety`);
  if (a.language && a.language !== "English") qs.push(`${a.language} speaking therapist ${city} anxiety`);
  return [...new Set(qs)].slice(0, 6);
}

/**
 * Real-time discovery: search the web, fetch and parse pages as she waits, and emit updated ranked results after every page.
 * Uses Bright Data (public pages only) and Gemini extraction; everything is stored in Neon with source and checked time.
 */
export async function liveDiscover(answers: Answers, specs: Spec[], emit: (e: any) => void, budgetMs = 50000) {
  const t0 = Date.now();
  const queries = liveQueries(answers, specs);
  emit({ type: "status", text: `Searching the web for ${queries.length} kinds of support near ${answers.city}…` });
  const hitLists = await Promise.all(queries.map((qq) => serpLinks(qq, 3).catch(() => [])));
  const urls: string[] = [];
  for (const h of hitLists.flat()) { try { if (!SKIP_HOSTS.test(new URL(h.url).hostname) && !urls.includes(h.url)) urls.push(h.url); } catch {} }
  const recent = new Set((await q<{ source_url: string }>(`SELECT source_url FROM providers WHERE checked_at > now() - interval '12 hours' UNION SELECT source_url FROM groups WHERE checked_at > now() - interval '12 hours'`)).map((r) => r.source_url));
  const todo = urls.filter((u) => !recent.has(u)).slice(0, 12);
  emit({ type: "status", text: `Found ${urls.length} pages${urls.length - todo.length ? ` (${urls.length - todo.length} checked recently)` : ""}. Reading ${todo.length} now…` });
  emit({ type: "results", ...(await rank(answers, specs)) });

  let done = 0, queue = [...todo];
  const worker = async () => {
    while (queue.length && Date.now() - t0 < budgetMs) {
      const u = queue.shift()!;
      let host = u; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch {}
      emit({ type: "status", text: `Reading ${host}…` });
      try { await ingestPage(u); } catch (e) { console.error("live ingest failed", host, (e as Error).message); }
      done++;
      emit({ type: "results", ...(await rank(answers, specs)) });
      emit({ type: "status", text: `Read ${done} of ${todo.length} pages…` });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  emit({ type: "status", text: queue.length ? `Stopped early to keep this quick. Read ${done} of ${todo.length} pages.` : `Done. Read ${done} pages.` });
}
