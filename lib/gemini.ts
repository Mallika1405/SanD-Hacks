import { GoogleGenAI } from "@google/genai";

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;
const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** Returns parsed JSON (or text if json=false). Returns null on any failure/timeout: callers MUST have a deterministic fallback. */
export async function gemini<T = any>(prompt: string, json = true, opts: { timeoutMs?: number; system?: string } = {}): Promise<T | null> {
  if (!geminiEnabled()) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, apiVersion: "v1beta" });
    const call = ai.models.generateContent({
      model: MODEL(),
      contents: prompt,
      config: {
        ...(json ? { responseMimeType: "application/json" } : {}),
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        thinkingConfig: { thinkingBudget: 0 }, // speed matters in a live voice turn
        temperature: 0.4,
      },
    });
    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("gemini timeout")), opts.timeoutMs ?? 6000)),
    ]);
    const t = res.text ?? "";
    return json ? (JSON.parse(t) as T) : (t as unknown as T);
  } catch (e) {
    console.error("gemini failed:", (e as Error).message);
    return null;
  }
}
