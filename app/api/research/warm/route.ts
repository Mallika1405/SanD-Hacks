import { after, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { researchTechniques } from "@/lib/techniques";
import { brightEnabled } from "@/lib/brightdata";

export const maxDuration = 60;
let last = 0;

// Pre-fetches trusted-source techniques for the common cases so they are ready the moment someone needs them.
// Sends no user data: it only researches generic situations. Called by the home page; throttled.
export async function GET() {
  if (!brightEnabled() || Date.now() - last < 30 * 60_000) return NextResponse.json({ warming: false });
  last = Date.now();
  const jobs: [string, string, string][] = [["panic:panic-attack", "panic", "panic attack"], ["overwhelm:feeling-overwhelmed", "overwhelm", "feeling overwhelmed"]];
  const stale: typeof jobs = [];
  for (const j of jobs) {
    const [r] = await q<{ n: number }>("SELECT count(*)::int n FROM techniques WHERE situation_key=$1 AND checked_at > now() - interval '12 hours'", [j[0]]);
    if (!r.n) stale.push(j);
  }
  after(async () => { for (const j of stale) await researchTechniques(j[0], j[1], j[2], null); });
  return NextResponse.json({ warming: stale.length > 0 });
}
