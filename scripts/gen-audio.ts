import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { EXERCISES } from "../lib/exercises";
import { CRISIS_SEGS, MEDICAL_SEGS, SAFETY_QUESTION } from "../lib/safety";
import { fbKey } from "../lib/speech";
import { DEFAULT_VOICE } from "../lib/voices";

// Pre-generates fallback audio (default preset voice) so the demo works if the live voice path fails.
const CORE = ["orient-posture", "exhale-breath", "name-it", "ground-54321", "intr-notice"];
const texts = new Set<string>([
  "Good. Stay with me.", "Well done. Next step.", "Keep going. You're doing this.", "Good. Let's keep moving.", "That's it. Next.",
  "Okay. Slower.", "Okay. Let's change it. Follow my voice.", "Good. Stay with it.", "Okay. Let's continue. Follow my voice.",
  "I'm glad you're safe right now. Stay with me. We'll go slowly.",
  "You've done well. Stay here a little longer.", "Keep your feet on the floor, and keep your breathing slow.", "When you're ready, drink some water.",
  "If this has lasted much longer than twenty minutes, or you have chest pain, call 911. If you feel unsafe, call or text 988.",
  ...CRISIS_SEGS.map((s) => s.text), ...MEDICAL_SEGS.map((s) => s.text), ...SAFETY_QUESTION.map((s) => s.text),
  ...EXERCISES.filter((e) => CORE.includes(e.id)).flatMap((e) => e.segments.map((s) => s.text)),
]);

(async () => {
  const dir = path.join(process.cwd(), "public/audio"); fs.mkdirSync(dir, { recursive: true });
  const manifest: Record<string, string> = fs.existsSync(path.join(dir, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) : {};
  const todo = [...texts].filter((t) => !manifest[fbKey(t)]);
  console.log(`${texts.size} lines, ${todo.length} to generate`);
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (t) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE}?output_format=mp3_44100_64`, {
        method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.7, similarity_boost: 0.75, style: 0, speed: 0.88 } }),
      });
      if (!r.ok) { console.error("failed:", r.status, t.slice(0, 40)); return; }
      const k = fbKey(t); fs.writeFileSync(path.join(dir, `${k}.mp3`), Buffer.from(await r.arrayBuffer())); manifest[k] = `/audio/${k}.mp3`;
    }));
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log("manifest entries:", Object.keys(manifest).length);
})();
