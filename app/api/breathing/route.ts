import { NextResponse } from "next/server";
import { out, Seg } from "@/lib/speech";

const br = (ms: number) => `<break time="${ms / 1000}s" />`;
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
    steps.push(st(`Breathe in through your nose. ${br(700)} Two. ${br(600)} Three. ${br(600)} Four. ${br(500)} And one more small sip of air.`, 250, "Breathe in", 4200, 1.16));
    steps.push(st(`Now out, slowly, through your mouth. ${br(600)} Two. ${br(650)} Three. ${br(650)} Four. ${br(650)} Five. ${br(650)} Six. ${br(650)} Seven.`, 900, "Slowly out", 7500, 0.86));
    if (r < rounds) steps.push(st(r % 2 === 1 ? `${CUES[(r - 1) % CUES.length]}` : "Again.", 700, `Round ${r + 1}`, 2500, 1));
  }
  steps.push(
    st("Good. That was the last one. Let your breathing go back to normal now. No counting. Notice what's different, even a little.", 3000, "Rest", 4000, 1),
    st("If it's still loud, that's okay. We can do another round, or try something different.", 500, "Rest", 3000, 1),
  );
  const signed = out(steps.map(({ text, pause_ms }) => ({ text, pause_ms })));
  return NextResponse.json({ segments: signed.map((s, i) => ({ text: s.text, pause_ms: s.pause_ms, sig: s.sig, phase: steps[i].phase })), rounds });
}
