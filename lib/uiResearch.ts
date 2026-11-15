import { q } from "./db";
import { gemini } from "./gemini";
import { brightEnabled, serpLinks, unlock } from "./brightdata";
import { clean, DEFAULTS, ENUMS, UiSettings } from "./ui";

const OK_HOSTS = ["w3.org", "nngroup.com", "interaction-design.org", "smashingmagazine.com", "uxdesign.cc", "a11yproject.com", "ncbi.nlm.nih.gov", "nih.gov", "jmir.org", "adaa.org", "iocdf.org", "mind.org.uk", "autism.org.uk", "gov.uk", "uxmatters.com", "medium.com", "frontiersin.org", "sciencedirect.com", "springer.com"];
const hostOk = (u: string) => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return OK_HOSTS.some((d) => h === d || h.endsWith("." + d)); } catch { return false; } };

const QUERIES: Record<string, string[]> = {
  ocd: ["designing mobile app interface for people with OCD obsessive compulsive disorder usability calm design", "app interface design anxiety disorders low stimulation predictable layout guidelines"],
  panic: ["designing app interface for panic attacks large text high contrast calm UX", "mental health app design anxiety users usability recommendations"],
  gad: ["designing digital products for anxiety minimal interface reduce cognitive load worry"],
  social: ["designing apps for social anxiety users low pressure interface design"],
  overwhelm: ["sensory overload digital design low stimulation reduce motion cognitive accessibility", "cognitive accessibility guidelines reduce clutter interface mental health"],
};

const SYSTEM = `You read ONE web page about designing interfaces for people with anxiety-related conditions. Extract layout recommendations that the page itself supports.
Reply JSON {"none": boolean, "density": "airy"|"cozy"|"compact", "motion": "none"|"soft"|"normal", "palette": "sage"|"slate"|"sand"|"mist", "fontScale": number between 0.95 and 1.2, "focus": "single"|"balanced", "contrast": "normal"|"high", "rationale": [string] (up to 3 short sentences, plain language, based on the page), "quote": string (max 160 chars copied from the page)}.
Mapping: lots of white space or fewer elements -> airy; calm, muted, low-saturation color -> sage, slate, sand or mist (green=sage, blue-gray=slate, warm neutral=sand, soft lavender-gray=mist); reduce animation -> motion none or soft; larger text -> fontScale above 1; show fewer things at once or one task per screen -> focus single; high contrast needs -> contrast high.
If the page gives no usable design guidance, reply {"none": true}. Never invent.`;

const mode = <T,>(xs: T[]): T | undefined => { const m = new Map<T, number>(); xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };

export async function researchUi(cond: string, log: (s: string) => void = () => {}) {
  const def = DEFAULTS[cond] ?? DEFAULTS.other;
  let found: { s: Partial<UiSettings>; rationale: string[]; url: string; quote: string }[] = [];
  if (brightEnabled() && QUERIES[cond]) {
    const hits = (await Promise.all(QUERIES[cond].map((qq) => serpLinks(qq, 6).catch(() => [])))).flat();
    const urls = [...new Set(hits.map((h) => h.url).filter(hostOk))].slice(0, 4);
    log(`${cond}: ${urls.length} pages`);
    await Promise.all(urls.map(async (u) => {
      try {
        const text = await unlock(u, 12000);
        if (text.length < 400) return;
        const g = await gemini<any>(`CONDITION: ${cond}\nPAGE: ${u}\n\n${text}`, true, { system: SYSTEM, timeoutMs: 30000 });
        if (!g || g.none) return;
        found.push({ s: clean(g), rationale: Array.isArray(g.rationale) ? g.rationale.map(String).slice(0, 3) : [], url: u, quote: String(g.quote ?? "").slice(0, 200) });
        log(`  used ${new URL(u).hostname}`);
      } catch (e) { log(`  skipped ${u.slice(0, 60)}: ${(e as Error).message}`); }
    }));
  }
  // Adopt a researched value only when it is supported; for palette (rarely stated by sources) require two sources to agree, else keep the default.
  const pick = <K extends keyof UiSettings>(k: K, minAgree = 1): UiSettings[K] => {
    const vals = found.map((f) => f.s[k]).filter((v) => v != null) as UiSettings[K][];
    const top = mode(vals);
    return (top != null && vals.filter((v) => v === top).length >= minAgree ? top : def.settings[k]) as UiSettings[K];
  };
  const fs = found.map((f) => f.s.fontScale).filter((v): v is number => typeof v === "number");
  const settings: UiSettings = {
    density: pick("density"), motion: pick("motion"), palette: pick("palette", 2), focus: pick("focus"), contrast: pick("contrast"),
    fontScale: fs.length ? Math.round((fs.reduce((a, b) => a + b, 0) / fs.length) * 100) / 100 : def.settings.fontScale,
  };
  const rationale = [...new Set([...found.flatMap((f) => f.rationale), ...def.rationale])].slice(0, 5);
  const sources = found.map((f) => ({ url: f.url, name: new URL(f.url).hostname.replace(/^www\./, ""), quote: f.quote }));
  await q(
    `INSERT INTO ui_profiles(condition, settings, rationale, sources, researched_at) VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (condition) DO UPDATE SET settings=$2, rationale=$3, sources=$4, researched_at=now()`,
    [cond, JSON.stringify(settings), rationale, JSON.stringify(sources)]);
  return { cond, settings, sources: sources.length };
}
export { ENUMS };
