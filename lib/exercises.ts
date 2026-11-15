import type { Seg } from "./speech";

export type Flow = "panic" | "intrusive" | "overwhelm" | "unsure";
export type Exercise = {
  id: string; title: string; flows: Exclude<Flow, "unsure">[]; status: "needs human review"; segments: Seg[];
};

const s = (text: string, pause_ms = 1500, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });
const breath = (): Seg[] => [s("Breathe in slowly through your nose, for four.", 4200), s("Now let it out through your mouth, for six.", 6200)];

// Reviewed-exercise library. Gemini may only rephrase within these; nothing here is treatment.
export const EXERCISES: Exercise[] = [
  {
    id: "breathe-paced", title: "Slow breathing", flows: ["panic"], status: "needs human review",
    segments: [s("I'm here. There's no rush.", 1500), s("Let's breathe together.", 1200), ...breath(), s("Good.", 800), ...breath(), s("Nice and steady.", 800), ...breath(), s("Keep going at your own pace. I'm still here.", 3000)],
  },
  {
    id: "ground-54321", title: "Five things you can see", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Let's slow down together. You can take your time.", 1500),
      s("Look around you. Find five things you can see.", 4000),
      s("Say them out loud, or just in your head.", 6000, true),
      s("Now notice four things you can touch. Feel the texture.", 6000, true),
      s("Now three things you can hear.", 6000, true),
      s("Two things you can smell, or two slow breaths.", 5000),
      s("And one thing you can taste, or one more slow breath.", 4000),
      s("You're here. You're in this room.", 2500),
    ],
  },
  {
    id: "feet-floor", title: "Feet on the floor", flows: ["panic"], status: "needs human review",
    segments: [
      s("Let's start with your body.", 1200),
      s("Press your feet into the floor. Feel the ground holding you.", 4500),
      s("Press your hands together, firm but not too hard.", 4500),
      s("Let your shoulders drop, just a little.", 4000),
      s("Slow breath in.", 3500), s("And slowly out.", 5000),
      s("Your body is trying to protect you. We're helping it settle.", 3000),
    ],
  },
  {
    id: "intr-notice", title: "Noticing the thought", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("I'm here. That sounds really hard.", 1500),
      s("You don't have to figure the thought out right now.", 2500),
      s("Try saying to yourself: I'm having a thought.", 4000),
      s("A thought is something your mind is doing. It doesn't need an answer.", 3500),
      s("Let it be there, like a car passing on the street. You don't have to follow it.", 4500),
      s("Now feel your feet on the floor.", 4000),
      s("What's one thing you can see right here?", 6000, true),
      s("Good. Let your attention rest there.", 3000),
    ],
  },
  {
    id: "intr-uncertainty", title: "Letting it be uncertain", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Your mind may be asking for certainty.", 2500),
      s("We don't have to chase that answer. We can let it stay open.", 3500),
      s("Maybe, maybe not. Either way, you can let it sit.", 4000),
      s("Notice the pull to check or to go over it again. You don't have to follow it.", 4500),
      s("Bring your attention to your hands. What are they touching?", 6000, true),
      s("Stay with that, for a few slow breaths.", 7000),
    ],
  },
  {
    id: "intr-task", title: "Back to what's in front of you", flows: ["intrusive", "overwhelm"], status: "needs human review",
    segments: [
      s("Let's give your hands something to do.", 2000),
      s("Pick up something nearby. A cup, a pen, your phone's edge.", 5000),
      s("Notice its weight, and how it feels.", 5000),
      s("If the thought comes back, that's okay. Just come back to the object.", 5000),
      s("Now name three sounds around you.", 7000, true),
      s("Good. You're here, in this moment.", 2500),
    ],
  },
  {
    id: "orient-three", title: "Looking around the room", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("It sounds like a lot is happening at once.", 2000),
      s("We don't have to solve it right now.", 2500),
      s("Look slowly around the room. Let your eyes land on three things.", 6000, true),
      s("Notice the colors, and the shapes.", 5000),
      s("Now take one slow breath in, and out.", 5500),
      s("You're here. Right now, you're okay in this room.", 3000),
    ],
  },
  {
    id: "one-next-step", title: "One small next step", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Let's make this smaller.", 2000),
      s("Out of everything, you only need to pick one tiny thing.", 3500),
      s("Something that takes under two minutes. Drinking water, or standing up.", 6000, true),
      s("Just that one thing. Everything else can wait.", 3500),
      s("Take a slow breath, and do the small thing when you're ready.", 6000),
    ],
  },
];

export const BY_FLOW: Record<Exclude<Flow, "unsure">, string[]> = {
  panic: ["breathe-paced", "ground-54321", "feet-floor"],
  intrusive: ["intr-notice", "intr-uncertainty", "intr-task"],
  overwhelm: ["orient-three", "one-next-step", "ground-54321"],
};
export const getExercise = (id: string) => EXERCISES.find((e) => e.id === id)!;
