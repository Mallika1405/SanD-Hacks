import crypto from "crypto";
import fs from "fs";
import path from "path";

/** A spoken unit. pause_ms = silence after it. listen = the user is expected to answer out loud (naming things). */
export type Seg = { text: string; pause_ms: number; listen?: boolean };
export type OutSeg = Seg & { sig: string; fb?: string };

const secret = () => process.env.CRON_SECRET || process.env.ELEVENLABS_API_KEY || "somewhere";
export const sign = (t: string) => crypto.createHmac("sha256", secret()).update(t).digest("hex").slice(0, 32);
export const verify = (t: string, sig: string) => sig === sign(t);

let manifest: Record<string, string> | null = null;
/** Fallback audio is keyed by a plain hash of the text (not the signing secret) so it survives key changes. */
export const fbKey = (t: string) => crypto.createHash("sha1").update(t).digest("hex").slice(0, 16);
function fallbackFor(text: string): string | undefined {
  try {
    if (!manifest) manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/audio/manifest.json"), "utf8"));
    return manifest![fbKey(text)];
  } catch { return undefined; }
}

/** Sign segments so /api/sos/tts will only ever speak text this server produced. */
export function out(segs: Seg[], slow = false): OutSeg[] {
  return segs.map((s) => {
    const sig = sign(s.text);
    return { ...s, pause_ms: slow ? Math.round(s.pause_ms * 1.5) : s.pause_ms, sig, fb: fallbackFor(s.text) };
  });
}
