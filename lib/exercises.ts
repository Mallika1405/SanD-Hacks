import type { Seg } from "./speech";

export type Flow = "panic" | "intrusive" | "overwhelm" | "unsure";
export type Exercise = {
  id: string; title: string; flows: Exclude<Flow, "unsure">[]; status: "needs human review"; segments: Seg[];
};

// DIRECTIVE guidance: short imperative sentences, no questions, no waiting. See docs/EVIDENCE.md for the research behind each block.
const s = (text: string, pause_ms = 1500, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });

/** Cyclic sighing (double inhale through the nose, long exhale): the best-supported in-the-moment breathing. Gentle, never forced. */
const sigh = (): Seg[] => [s("Breathe in through your nose.", 2300), s("A second small sip of air in, to fill your lungs.", 1800), s("Now a long, slow breath out through your mouth.", 6500)];

// Reviewed-exercise library. Gemini may only rephrase within these; nothing here is treatment.
export const EXERCISES: Exercise[] = [
  {
    id: "orient-posture", title: "Settle your body", flows: ["panic"], status: "needs human review",
    segments: [
      s("I'm here. Do exactly what I say, one step at a time.", 1800),
      s("This is a wave of anxiety. It rises, it peaks, and it eases. You don't have to fight it.", 2800),
      s("Sit down if you can. Put both feet flat on the floor.", 4000),
      s("Let your back be supported. Let your shoulders drop.", 4000),
      s("Unclench your jaw. Let your tongue rest.", 4000),
      s("Open your hands, and let them rest.", 3500),
    ],
  },
  {
    id: "exhale-breath", title: "Slow breathing, long exhale", flows: ["panic", "overwhelm", "intrusive"], status: "needs human review",
    segments: [
      s("Now we'll breathe. Slow and gentle. No forcing.", 2200),
      ...sigh(), s("Good. Again.", 700),
      ...sigh(), s("Good. Again.", 700),
      ...sigh(), s("Again. Let the exhale be longer than the inhale.", 700),
      ...sigh(), s("Once more.", 600),
      ...sigh(), s("Good. Keep that slow rhythm.", 2500),
    ],
  },
  {
    id: "name-it", title: "Name it", flows: ["panic"], status: "needs human review",
    segments: [
      s("Now say this quietly, out loud or in your head: this is anxiety.", 5000),
      s("Say it again: this is anxiety. It's a feeling, and it's a wave.", 5000),
      s("Notice where you feel it in your body. Just notice it. Don't push it away.", 6500),
      s("Let it be there. Breathe out slowly around it.", 7000),
      s("You don't have to do anything else with it right now.", 3500),
    ],
  },
  {
    id: "ground-54321", title: "Five things you can see", flows: ["panic", "overwhelm", "intrusive"], status: "needs human review",
    segments: [
      s("Now we'll bring your attention to the room.", 2000),
      s("Look around. Find five things you can see. Name them to yourself.", 10000, true),
      s("Now four things you can feel. Your feet. Your clothes. The chair.", 9000, true),
      s("Three things you can hear. Listen past the loudest sound.", 8000, true),
      s("Two things you can smell, or two slow breaths.", 6000),
      s("One slow breath in, and out.", 6000),
      s("You're here, in this room, right now.", 3000),
    ],
  },
  {
    id: "muscle-release", title: "Tense and release", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Now we'll let go of the tension your body is holding.", 2000),
      s("Make two fists. Squeeze hard. Hold it.", 5000),
      s("Now let go. Feel your hands soften.", 5500),
      s("Pull your shoulders up toward your ears. Hold it.", 5000),
      s("Now drop them. Let them fall.", 5500),
      s("Press your feet into the floor. Hold it.", 5000),
      s("And release. Feel the weight settle.", 5500),
      s("Breathe out slowly.", 5000),
    ],
  },
  {
    id: "ride-wave", title: "Let the wave pass", flows: ["panic"], status: "needs human review",
    segments: [
      s("Picture the anxiety as a wave. Watch it rise.", 5000),
      s("You don't have to stop it. You don't have to do anything.", 4500),
      s("Breathe out slowly, and let it move through you.", 7000),
      s("Waves peak, and then they ease. Keep breathing out, long and slow.", 7000),
      s("Stay with the breath. Just the next exhale.", 6000),
    ],
  },
  {
    id: "ow-settle", title: "Slow everything down", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("I'm here. Do exactly what I say, one step at a time.", 1800),
      s("It's a lot right now. You don't have to solve any of it yet.", 3000),
      s("Stop what you're doing. Put your hands down.", 3500),
      s("Feel both feet on the floor.", 4000),
      s("Let your shoulders drop.", 4000),
    ],
  },
  {
    id: "ow-orient", title: "Look around the room", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Now look slowly around the room.", 3000),
      s("Let your eyes land on three things. Name each one to yourself.", 9000, true),
      s("Notice the colors. Notice the shapes.", 6000),
      s("Feel the surface under your hands.", 5000),
      s("You're in this room, right now.", 3000),
    ],
  },
  {
    id: "ow-one-thing", title: "One small thing", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Everything else can wait. We're only doing one small thing.", 3500),
      s("Your one thing: drink a glass of water. Go and get it now.", 12000),
      s("Sip it slowly. Feel it go down.", 6000),
      s("Next: stand up and stretch your arms overhead. Slowly.", 7000),
      s("Now sit back down. That's two things done.", 3000),
    ],
  },
  {
    id: "intr-notice", title: "Noticing the thought", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("I'm here. Do exactly what I say, one step at a time.", 1800),
      s("You don't have to work the thought out. Not right now.", 3000),
      s("Say to yourself: I'm having a thought.", 4500),
      s("A thought is something your mind is doing. It doesn't need an answer.", 4000),
      s("Don't argue with it. Don't check. Don't go over it again.", 5000),
      s("Let it be there, like a car passing on the street. You don't have to follow it.", 5000),
      s("Now feel your feet on the floor.", 4000),
    ],
  },
  {
    id: "intr-uncertainty", title: "Letting it stay uncertain", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Your mind may be asking for certainty.", 2800),
      s("You don't have to chase that answer. You can let it stay open.", 4000),
      s("Maybe, maybe not. Either way, you can let it sit.", 4500),
      s("Notice the pull to check, or to go over it again. Let the pull be there. Don't follow it.", 6000),
      s("Bring your attention to your hands. Feel what they're touching.", 7000),
      s("Stay with that, for a few slow breaths.", 8000),
    ],
  },
  {
    id: "intr-task", title: "Back to what's in front of you", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Now give your hands something to do.", 2500),
      s("Pick up something nearby. A cup, a pen, your phone.", 5000),
      s("Notice its weight. Notice how it feels.", 6000),
      s("If the thought comes back, that's okay. Come back to the object.", 6000),
      s("Name three sounds around you.", 8000, true),
      s("Good. Your attention is here, in this moment.", 3000),
    ],
  },
];

// Order matters: this is the arc a person is walked through. The agent moves to the next block on its own, with no questions.
export const BY_FLOW: Record<Exclude<Flow, "unsure">, string[]> = {
  panic: ["orient-posture", "exhale-breath", "name-it", "ground-54321", "muscle-release", "ride-wave"],
  overwhelm: ["ow-settle", "exhale-breath", "ow-orient", "ow-one-thing", "muscle-release", "ground-54321"],
  intrusive: ["intr-notice", "exhale-breath", "intr-uncertainty", "intr-task", "ground-54321"],
};
export const getExercise = (id: string) => EXERCISES.find((e) => e.id === id)!;
