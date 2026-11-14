import { config } from "dotenv";
config({ path: ".env.local" });
import { q } from "../lib/db";

async function main() {
  await q("DELETE FROM users WHERE name='Maya (demo)'");
  const [u] = await q<{ id: string }>("INSERT INTO users(name, phone) VALUES ('Maya (demo)', $1) RETURNING id", [process.env.SEED_PHONE_USER || "+15555550100"]);
  const phones = [process.env.SEED_PHONE_1, process.env.SEED_PHONE_2, process.env.SEED_PHONE_3];
  const names = ["Priya", "Jordan", "Mom"];
  for (let i = 0; i < 3; i++)
    await q("INSERT INTO contacts(user_id,name,phone,opted_in_at) VALUES ($1,$2,$3,now())", [u.id, names[i], phones[i] || `+1555555010${i + 1}`]);
  console.log("Seeded demo user", u.id, "with 3 opted-in contacts. Set SEED_PHONE_1..3 in .env.local to real numbers first for live calls.");
}
main().catch((e) => { console.error(e); process.exit(1); });
