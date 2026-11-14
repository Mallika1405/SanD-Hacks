import { GoogleGenAI } from "@google/genai";

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;

/** Returns parsed JSON (or text if json=false). Returns null on any failure — callers must have a fallback. */
export async function gemini<T = any>(prompt: string, json = true): Promise<T | null> {
  if (!geminiEnabled()) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: json ? { responseMimeType: "application/json" } : undefined,
    });
    const t = res.text ?? "";
    return json ? (JSON.parse(t) as T) : (t as unknown as T);
  } catch (e) {
    console.error("gemini failed", e);
    return null;
  }
}
