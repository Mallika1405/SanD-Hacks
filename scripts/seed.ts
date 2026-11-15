import { config } from "dotenv";
config({ path: ".env.local" });
import { q } from "../lib/db";

async function main() {
  await q("DELETE FROM users WHERE name IN ('Maya','Maya (demo)')");
  const [u] = await q<{ id: string }>("INSERT INTO users(name, phone) VALUES ('Maya', $1) RETURNING id", [process.env.SEED_PHONE_USER || "+15555550100"]);
  const phones = [process.env.SEED_PHONE_1, process.env.SEED_PHONE_2, process.env.SEED_PHONE_3];
  const names = ["Priya", "Jordan", "Mom"];
  for (let i = 0; i < 3; i++)
    await q("INSERT INTO contacts(user_id,name,phone,opted_in_at) VALUES ($1,$2,$3,now())", [u.id, names[i], phones[i] || `+1555555010${i + 1}`]);
  // Demo cache so safe places, routes and the heat overlay work without any API keys.
  const demo = [
    ["demo:geisel", "Geisel Library (demo)", "library", 32.8812, -117.2376, "24 hours during finals; otherwise 8:00 AM - 10:00 PM", true],
    ["demo:pc", "Price Center (demo)", "convenience", 32.8797, -117.2362, "7:00 AM - 11:00 PM", false],
    ["demo:ralphs", "Corner Market (demo)", "convenience", 32.8788, -117.2338, "6:00 AM - 12:00 AM", false],
    ["demo:thornton", "Thornton Hospital ER (demo)", "hospital", 32.8869, -117.2285, "Open 24 hours", true],
    ["demo:police", "UCSD Police (demo)", "police", 32.8855, -117.2395, "Open 24 hours", true],
  ] as const;
  for (const d of demo) {
    const [p] = await q<{ id: string }>(`INSERT INTO places(external_id,name,category,geom) VALUES ($1,$2,$3,ST_SetSRID(ST_MakePoint($5,$4),4326)::geography)
      ON CONFLICT (external_id) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [d[0], d[1], d[2], d[3], d[4]]);
    await q("DELETE FROM place_facts WHERE place_id=$1", [p.id]);
    await q("INSERT INTO place_facts(place_id,source_url,hours_text,open_24h,staffed,confidence,uncertain) VALUES ($1,$2,$3,$4,true,0.6,false)", [p.id, "https://example.com/demo-seed", d[5], d[6]]);
  }
  await q("DELETE FROM incidents WHERE kind='demo'");
  for (const [la, ln] of [[32.8790, -117.2350], [32.8791, -117.2352], [32.8794, -117.2358], [32.8803, -117.2368]])
    await q("INSERT INTO incidents(cell,geom,kind,occurred_at,visible_after) VALUES ('demo', ST_SetSRID(ST_MakePoint($2,$1),4326)::geography,'demo', now() - interval '2 days', now() - interval '1 day')", [la, ln]);
  console.log("Seeded demo user", u.id, "with 3 opted-in contacts. Set SEED_PHONE_1..3 in .env.local to real numbers first for live calls.");
}
main().catch((e) => { console.error(e); process.exit(1); });
