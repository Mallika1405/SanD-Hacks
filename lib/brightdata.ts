const ENDPOINT = "https://api.brightdata.com/request";
export const brightEnabled = () => !!process.env.BRIGHTDATA_API_KEY;

async function bd(zone: string, url: string) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}` },
    body: JSON.stringify({ zone, url, format: "raw" }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`brightdata ${r.status}`);
  return r.text();
}

const strip = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Fetch a page through Web Unlocker, returned as plain text. */
export async function unlock(url: string, max = 12000) {
  return strip(await bd(process.env.BRIGHTDATA_UNLOCKER_ZONE || "web_unlocker1", url)).slice(0, max);
}
/** Google SERP via Bright Data; returns plain text of results. */
export async function serp(query: string, max = 8000) {
  const u = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;
  return strip(await bd(process.env.BRIGHTDATA_SERP_ZONE || "serp_api1", u)).slice(0, max);
}
