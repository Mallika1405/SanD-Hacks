// Bright Data: SERP API (parsed JSON) + Web Unlocker. Public pages only, no logins.
const ENDPOINT = "https://api.brightdata.com/request";
export const brightEnabled = () => !!process.env.BRIGHTDATA_API_KEY;

async function bd(body: Record<string, unknown>, timeoutMs: number) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}` },
    body: JSON.stringify({ format: "raw", country: "us", ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`brightdata ${r.status}`);
  return r.text();
}

const strip = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();

/** Fetch a public page through Web Unlocker as plain text. */
export async function unlock(url: string, max = 14000) {
  const html = await bd({ zone: process.env.BRIGHTDATA_UNLOCKER_ZONE || "web_unlocker1", url }, 45000);
  return strip(html).slice(0, max);
}

export type SerpHit = { url: string; title: string; snippet: string };

async function resolveRedirect(link: string): Promise<string | null> {
  try {
    const u = new URL(link);
    if (!/(^|\.)google\.com$/.test(u.hostname)) return link;
    const direct = u.searchParams.get("q") || u.searchParams.get("url");
    if (direct && /^https?:\/\//.test(direct)) return direct;
    const r = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(6000) });
    const loc = r.headers.get("location");
    return loc && !/google\.com/.test(new URL(loc, link).hostname) ? new URL(loc, link).toString() : null;
  } catch { return null; }
}

/** Google results as real URLs (parsed JSON via brd_json=1). Retries with a short backoff: the API sometimes replies empty or says it is busy. */
export async function serpLinks(query: string, limit = 5): Promise<SerpHit[]> {
  const zone = process.env.BRIGHTDATA_SERP_ZONE || "serp_api1";
  // If the search API says this exact query "recently failed" (it blocks repeats for 15 seconds), retry a lightly reworded version instead of waiting.
  const variants = [query, `${query} best`, `${query} near me`];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 700 * attempt));
    const q = variants[attempt];
    try {
      const txt = await bd({ zone, url: `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&gl=us&brd_json=1` }, 40000);
      let j: any;
      try { j = JSON.parse(txt); } catch { console.error("serp non-JSON reply:", txt.slice(0, 120)); continue; }
      const hits: SerpHit[] = [];
      for (const o of j.organic ?? []) {
        const url = await resolveRedirect(o.link ?? o.url ?? "");
        if (url && /^https?:\/\//.test(url)) hits.push({ url, title: o.title ?? "", snippet: o.description ?? "" });
        if (hits.length >= limit) break;
      }
      if (hits.length) return hits;
    } catch (e) { console.error("serp retry", (e as Error).message); }
  }
  return [];
}
