import { config } from "dotenv";
config({ path: ".env.local" });
import { refreshArea } from "../lib/safehaven";

async function main() {
  // UCSD area: campus core, Price Center, La Jolla Village
  const pts = [[32.8801, -117.234], [32.8650, -117.2480], [32.8730, -117.2250]];
  for (const [lat, lng] of pts) console.log(await refreshArea(lat, lng, 1800, 24));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
