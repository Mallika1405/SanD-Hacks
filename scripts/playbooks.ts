import { config } from "dotenv"; config({ path: ".env.local" });
import { buildPlaybook, CONDITIONS } from "../lib/playbooks";
(async () => {
  const only = process.argv[2];
  for (const k of Object.keys(CONDITIONS)) {
    if (only && only !== k) continue;
    try { const r = await buildPlaybook(k, console.log); console.log(`✓ ${k}: ${r.content.inTheMoment.length} steps from ${r.sources.length} sources`); }
    catch (e) { console.error(`✗ ${k}:`, (e as Error).message); }
  }
  process.exit(0);
})();
