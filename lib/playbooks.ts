import { q } from "./db";
import { gemini } from "./gemini";
import { brightEnabled, serpLinks, unlock } from "./brightdata";

/**
 * A "playbook" per condition: what actually helps in the moment and how to talk with the person, built from
 *  (1) public pages on trusted health sites read live through Bright Data, and
 *  (2) peer-reviewed abstracts from PubMed (reviews, meta-analyses, trials),
 * then synthesised by Gemini with every item citing its source. Stored in Neon and fed to Juno, the diary and the guided flows.
 */
export type Source = { id: string; type: "web" | "pubmed"; title: string; url: string };
export type Playbook = { summary: string; inTheMoment: { step: string; why: string; source: string }[]; conversationStyle: string[]; avoid: string[]; evidenceNotes: string; seekHelp: string };

export const CONDITIONS: Record<string, { label: string; web: string[]; pubmed: string }> = {
  panic: { label: "Panic attacks", web: ["what to do during a panic attack how to calm down", "panic attack self help breathing grounding"], pubmed: "panic disorder cognitive behavioral therapy interoceptive exposure" },
  ocd: { label: "OCD and intrusive thoughts", web: ["OCD what to do when an intrusive thought or urge hits delay compulsion", "OCD reassurance seeking how to respond ERP self help"], pubmed: "obsessive-compulsive disorder exposure response prevention" },
  gad: { label: "Constant worry", web: ["generalized anxiety worry coping techniques self help", "how to stop spiraling worry grounding"], pubmed: "generalized anxiety disorder worry cognitive behavioral therapy" },
  social: { label: "Social anxiety", web: ["social anxiety coping before social situation self help", "social anxiety safety behaviors attention outward"], pubmed: "social anxiety disorder cognitive therapy safety behaviours self-focused attention" },
  overwhelm: { label: "Stress and burnout", web: ["feeling overwhelmed grounding calm down techniques", "burnout stress recovery self help small steps"], pubmed: "burnout stress management intervention randomized" },
};

const ALLOW = ["nhs.uk", "nimh.nih.gov", "mayoclinic.org", "adaa.org", "anxiety.org", "iocdf.org", "nami.org", "cdc.gov", "medlineplus.gov", "health.harvard.edu", "apa.org", "mind.org.uk", "helpguide.org", "clevelandclinic.org", "hopkinsmedicine.org", "samhsa.gov", "mentalhealth.org.uk", "anxietycanada.com", "ocduk.org"];
const SITE = `(${ALLOW.slice(0, 9).map((d) => `site:${d}`).join(" OR ")})`;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const allowed = (u: string) => ALLOW.some((d) => host(u) === d || host(u).endsWith("." + d));

async function pubmed(term: string, n = 4) {
  try {
    const f = "AND (systematic review[pt] OR meta-analysis[pt] OR randomized controlled trial[pt] OR review[pt])";
    const s = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${n}&sort=relevance&term=${encodeURIComponent(`${term} ${f} AND hasabstract`)}`, { signal: AbortSignal.timeout(12000) }).then((r) => r.json());
    const ids: string[] = s?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const xml = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.text());
    return [...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)].map((m) => {
      const b = m[1], g = (re: RegExp) => (b.match(re)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
      const pmid = g(/<PMID[^>]*>(\d+)<\/PMID>/), year = g(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
      const abs = [...b.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((a) => a[1].replace(/<[^>]+>/g, "")).join(" ");
      return { pmid, title: g(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/), journal: g(/<Title>([\s\S]*?)<\/Title>/), year, abstract: abs.slice(0, 1800) };
    }).filter((a) => a.pmid && a.abstract);
  } catch (e) { console.error("pubmed failed", (e as Error).message); return []; }
}

const SYSTEM = `You write an evidence-based "playbook" for a calm, voice-first support app, for people with a particular condition.
You get SOURCES: public pages from trusted health sites ([W1], [W2]...) and peer-reviewed abstracts ([P1], [P2]...). Use ONLY what these sources support. Do not add anything from memory.
Return JSON {"summary": string (1 to 2 sentences: what tends to help and what is the core idea),
"inTheMoment": [{"step": string (a short, concrete, spoken instruction like "Breathe out longer than you breathe in"), "why": string (one plain sentence), "source": string (an id like W1 or P2)}] (4 to 6 items, ordered from first thing to do),
"conversationStyle": string[] (3 to 4 short rules for HOW to talk with this person, each backed by a source),
"avoid": string[] (2 to 4 things not to say or do, backed by a source),
"evidenceNotes": string (honest: what kind of evidence this is, and its limits),
"seekHelp": string (when to suggest a clinician, plainly)}.
Never include medication or doses, never diagnose, never promise it will stop right now, and never use "calm down" or "relax" as an instruction. If sources conflict or are thin, say so in evidenceNotes.`;

export async function buildPlaybook(key: string, log: (s: string) => void = () => {}) {
  const c = CONDITIONS[key]; if (!c) throw new Error("unknown condition");
  const sources: Source[] = []; const blocks: string[] = [];
  if (brightEnabled()) {
    const urls: { url: string; title: string }[] = [];
    for (const qq of c.web) for (const h of await serpLinks(`${qq} ${SITE}`, 5)) if (allowed(h.url) && !urls.some((u) => u.url === h.url)) urls.push({ url: h.url, title: h.title });
    log(`${key}: ${urls.length} trusted pages`);
    for (const u of urls.slice(0, 4)) {
      try {
        const t = await unlock(u.url, 7000); if (t.length < 400) continue;
        const id = `W${sources.filter((s) => s.type === "web").length + 1}`;
        sources.push({ id, type: "web", title: `${u.title.slice(0, 90)} (${host(u.url)})`, url: u.url }); blocks.push(`[${id}] ${host(u.url)}: ${t}`);
      } catch (e) { log(`  skip ${host(u.url)}: ${(e as Error).message}`); }
    }
  }
  const papers = await pubmed(c.pubmed, 4); log(`${key}: ${papers.length} PubMed abstracts`);
  papers.forEach((p, i) => { const id = `P${i + 1}`; sources.push({ id, type: "pubmed", title: `${p.title.slice(0, 120)} (${p.journal}, ${p.year})`, url: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` }); blocks.push(`[${id}] ${p.title} (${p.journal}, ${p.year}). ${p.abstract}`); });
  if (!blocks.length) throw new Error("no sources found");
  const pb = await gemini<Playbook>(`CONDITION: ${c.label}\n\nSOURCES:\n${blocks.join("\n\n")}`, true, { system: SYSTEM, timeoutMs: 60000 });
  if (!pb?.inTheMoment?.length) throw new Error("synthesis failed");
  const ids = new Set(sources.map((s) => s.id));
  const content: Playbook = {
    summary: String(pb.summary ?? "").slice(0, 400),
    inTheMoment: pb.inTheMoment.filter((x) => ids.has(String(x.source))).slice(0, 6).map((x) => ({ step: String(x.step).slice(0, 160), why: String(x.why).slice(0, 220), source: String(x.source) })),
    conversationStyle: (pb.conversationStyle ?? []).map((x) => String(x).slice(0, 200)).slice(0, 4),
    avoid: (pb.avoid ?? []).map((x) => String(x).slice(0, 200)).slice(0, 4),
    evidenceNotes: String(pb.evidenceNotes ?? "").slice(0, 400), seekHelp: String(pb.seekHelp ?? "").slice(0, 240),
  };
  await q(`INSERT INTO playbooks(condition, content, sources, researched_at) VALUES ($1,$2,$3,now()) ON CONFLICT (condition) DO UPDATE SET content=$2, sources=$3, researched_at=now()`, [key, JSON.stringify(content), JSON.stringify(sources)]);
  return { content, sources };
}

const PRIORITY = ["ocd", "panic", "social", "gad", "overwhelm"];
/** A compact version for Juno's prompt and the other conversations. Empty if nothing has been researched yet. */
export async function playbookText(conditions: string[] | null | undefined, max = 1500): Promise<string> {
  const key = PRIORITY.find((k) => (conditions ?? []).includes(k)) ?? (conditions?.includes("other") ? "panic" : null);
  if (!key) return "";
  const [r] = await q<{ content: Playbook }>("SELECT content FROM playbooks WHERE condition=$1", [key]);
  if (!r) return "";
  const c = r.content;
  const t = `${CONDITIONS[key].label}: ${c.summary} In the moment, in this order: ${c.inTheMoment.map((x, i) => `${i + 1}) ${x.step} (${x.why})`).join(" ")} How to talk: ${c.conversationStyle.join(" ")} Avoid: ${c.avoid.join(" ")} Evidence: ${c.evidenceNotes}`;
  return t.slice(0, max);
}
