import { config } from "dotenv";
config({ path: ".env.local" });
import { researchUi } from "../lib/uiResearch";

(async () => {
  for (const c of (process.argv[2] ?? "ocd,panic,gad,social,overwhelm").split(",")) console.log(JSON.stringify(await researchUi(c, (s) => console.log(s))));
  process.exit(0);
})();
