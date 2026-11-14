import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { q } from "../lib/db";

async function main() {
  await q("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
  const dir = path.join(process.cwd(), "migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = await q("SELECT 1 FROM schema_migrations WHERE name=$1", [f]);
    if (done.length) continue;
    const stmts = fs.readFileSync(path.join(dir, f), "utf8").split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
    for (const s of stmts) await q(s);
    await q("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
    console.log("applied", f);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
