import { NextResponse } from "next/server";
import { out, Seg } from "@/lib/speech";

const br = (ms: number) => `<break time="${ms / 1000}s" />`;
// What to feel during each breath out, so the voice keeps guiding the whole way through and not only counting.
const OUT = [
  (b: (n: number) => string) => `Now out, slowly, through your mouth. ${b(600)} Two. ${b(500)} Let your shoulders drop. ${b(600)} Three. ${b(600)} Four. ${b(500)} Feel your jaw soften. ${b(600)} Five. ${b(650)} Six. ${b(650)} Seven.`,
  (b: (n: number) => string) => `Now out, slowly. ${b(600)} Two. ${b(500)} Feel your hands get heavy. ${b(600)} Three. ${b(600)} Four. ${b(500)} Let your belly go soft. ${b(600)} Five. ${b(650)} Six. ${b(650)} Seven.`,
  (b: (n: number) => string) => `And out, slowly. ${b(600)} Two. ${b(500)} Feel your feet on the floor. ${b(600)} Three. ${b(600)} Four. ${b(500)} Let the thoughts drift past. ${b(600)} Five. ${b(650)} Six. ${b(650)} Seven.`,
  (b: (n: number) => string) => `And out, slowly. ${b(600)} Two. ${b(500)} Notice where your body is held up by the chair. ${b(600)} Three. ${b(600)} Four. ${b(600)} Five. ${b(650)} Six. ${b(650)} Seven.`,
];
const IN = [
  (b: (n: number) => string) => `Breathe in through your nose. ${b(700)} Two. ${b(600)} Three. ${b(600)} Four. ${b(500)} And one more small sip of air.`,
  (b: (n: number) => string) => `In through your nose. ${b(700)} Two. ${b(600)} Feel your belly rise. ${b(600)} Three. ${b(600)} Four. ${b(500)} One more small sip.`,
  (b: (n: number) => string) => `In through your nose. ${b(700)} Two. ${b(600)} Three. ${b(600)} Four. ${b(500)} A little more.`,
  (b: (n: number) => string) => `In, gently. ${b(700)} Two. ${b(600)} Three. ${b(600)} Four. ${b(500)} A last small sip.`,
];
const CUES = [
  "Good. Let your shoulders get a little heavier.",
  "That's it. Your breath is already starting to slow.",
  "Nice. Feel your feet on the floor.",
  "You're doing it. A longer breath out than in is what settles the body.",
  "Keep it easy. There's no wrong way to do this.",
  "Soften your jaw, and your hands.",
  "Almost there. Just a few more.",
];
type Step = Seg & { phase: { label: string; ms: number; scale: number } };
const st = (text: string, pause_ms: number, label: string, ms: number, scale: number): Step => ({ text, pause_ms, phase: { label, ms, scale } });

/** A full, timed breathing walkthrough: every breath counted out loud, with something kind between rounds. Played by the browser in the person's chosen voice. */
export async function GET(req: Request) {
  const rounds = Math.min(4, Math.max(3, Number(new URL(req.url).searchParams.get("rounds")) || 3));
  const steps: Step[] = [
    st("Okay. We're going to breathe together, and I'll count every breath. There's nothing to get right. Let your feet rest flat, and let your shoulders drop.", 2500, "Get comfortable", 5000, 1),
    st("When I say in, breathe in through your nose. When I say out, let it go slowly through your mouth. Here we go.", 1500, "Settle in", 4000, 1),
  ];
  for (let r = 1; r <= rounds; r++) {
    steps.push(st(IN[(r - 1) % IN.length](br), 250, "Breathe in", 4200, 1.16));
    steps.push(st(OUT[(r - 1) % OUT.length](br), 900, "Slowly out", 8500, 0.86));
    if (r < rounds) steps.push(st(r % 2 === 1 ? `${CUES[(r - 1) % CUES.length]}` : "Again.", 700, `Round ${r + 1}`, 2500, 1));
  }
  steps.push(
    st("Good. That was the last one. Let your breathing go back to normal now. No counting. Notice what's different, even a little.", 3000, "Rest", 4000, 1),
    st("If it's still loud, that's okay. We can do another round, or try something different.", 500, "Rest", 3000, 1),
  );
  const signed = out(steps.map(({ text, pause_ms }) => ({ text, pause_ms })));
  return NextResponse.json({ segments: signed.map((s, i) => ({ text: s.text, pause_ms: s.pause_ms, sig: s.sig, phase: steps[i].phase })), rounds });
}
