import type { Seg } from "./speech";

export type Flow = "panic" | "intrusive" | "overwhelm" | "unsure";
export type Exercise = {
  id: string; title: string; blurb: string; flows: Exclude<Flow, "unsure">[]; status: "needs human review"; segments: Seg[];
};

// DIRECTIVE guidance in a human voice: short, warm, spoken-style sentences. No questions, no waiting. See docs/EVIDENCE.md.
const s = (text: string, pause_ms = 1500, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });

/** Cyclic sighing (double inhale through the nose, long exhale): the best-supported in-the-moment breathing. Gentle, never forced. */
const sigh = (tail: string): Seg[] => [s("Breathe in through your nose.", 1800), s("A little more air in. One more sip.", 1300), s("And let it out, long and slow, through your mouth.", 5200), s(tail, 500)];

// Reviewed-exercise library. Gemini may only rephrase within these; nothing here is treatment.
export const EXERCISES: Exercise[] = [
  {
    id: "orient-posture", title: "Settle your body", blurb: "Sit, feet down, shoulders drop", flows: ["panic"], status: "needs human review",
    segments: [
      s("Hey. I'm right here with you. I'm going to talk you through this, one step at a time.", 1300),
      s("What you're feeling is a wave of anxiety. It builds, it peaks, and then it eases. You don't have to fight it.", 2000),
      s("First, sit down if you can, and put both feet flat on the floor.", 2800),
      s("Let the chair hold your weight. Let your shoulders drop.", 2800),
      s("Unclench your jaw. Let your tongue go soft.", 2800),
      s("And open your hands. Let them rest.", 2200),
    ],
  },
  {
    id: "exhale-breath", title: "Slow breathing", blurb: "Long exhale, no forcing", flows: ["panic", "overwhelm", "intrusive"], status: "needs human review",
    segments: [
      s("Okay. Now we'll breathe together. Nice and gentle. No forcing it.", 1500),
      ...sigh("That's it."), ...sigh("Good."), ...sigh("Again."), ...sigh("You're doing great."), ...sigh("Once more."),
      s("Keep that slow rhythm going.", 2200),
    ],
  },
  {
    id: "name-it", title: "Name it", blurb: "Say what it is: this is anxiety", flows: ["panic"], status: "needs human review",
    segments: [
      s("Now say this quietly, out loud or just in your head: this is anxiety.", 3400),
      s("Say it again. This is anxiety. It's a feeling, and it's a wave.", 3400),
      s("Notice where it sits in your body. Just notice it. You don't have to push it away.", 4600),
      s("Let it be there, and breathe out slowly around it.", 5000),
      s("You don't have to do anything else with it right now.", 2600),
    ],
  },
  {
    id: "ground-54321", title: "Five things you can see", blurb: "Bring your attention to the room", flows: ["panic", "overwhelm", "intrusive"], status: "needs human review",
    segments: [
      s("Now let's bring your attention to the room around you.", 1500),
      s("Look around, and find five things you can see. Name them to yourself.", 7500, true),
      s("Now four things you can feel. Your feet on the floor. Your clothes. The chair.", 6500, true),
      s("Three things you can hear. Try to listen past the loudest sound.", 5500),
      s("Two things you can smell, or just take two slow breaths.", 4200),
      s("One more slow breath in, and out.", 4200),
      s("You're here, in this room, right now.", 2400),
    ],
  },
  {
    id: "muscle-release", title: "Tense and release", blurb: "Squeeze, then let go", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Let's let go of some of that tension.", 1400),
      s("Make two tight fists, and squeeze. Hold it.", 3800),
      s("Now let go. Feel your hands soften.", 4200),
      s("Pull your shoulders up toward your ears. Hold.", 3800),
      s("And drop them. Let them fall.", 4200),
      s("Now press your feet into the floor. Hold.", 3800),
      s("And release. Feel the weight settle.", 4200),
      s("Breathe out slowly.", 3200),
    ],
  },
  {
    id: "ride-wave", title: "Let the wave pass", blurb: "Watch it rise, and ease", flows: ["panic"], status: "needs human review",
    segments: [
      s("Picture the anxiety as a wave. Just watch it rise.", 3800),
      s("You don't have to stop it. You don't have to do anything.", 3200),
      s("Breathe out slowly, and let it move through you.", 5200),
      s("Waves peak, and then they ease. Keep breathing out, long and slow.", 5200),
      s("Stay with the breath. Just the next exhale.", 4200),
    ],
  },
  {
    id: "ow-settle", title: "Slow everything down", blurb: "Stop, feet down, shoulders drop", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Hey. I'm right here. I'm going to talk you through this, one step at a time.", 1300),
      s("It's a lot right now. You don't have to solve any of it yet.", 2600),
      s("Stop what you're doing, and put your hands down.", 3000),
      s("Feel both feet on the floor.", 3400),
      s("Let your shoulders drop.", 3200),
    ],
  },
  {
    id: "ow-orient", title: "Look around the room", blurb: "Name three things you can see", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Now look slowly around the room.", 2400),
      s("Let your eyes land on three things. Name each one to yourself.", 7500, true),
      s("Notice the colors. Notice the shapes.", 5000),
      s("Feel the surface under your hands.", 4200),
      s("You're in this room, right now.", 2400),
    ],
  },
  {
    id: "ow-one-thing", title: "One small thing", blurb: "Water, stretch, nothing else", flows: ["overwhelm"], status: "needs human review",
    segments: [
      s("Everything else can wait. We're only doing one small thing.", 3000),
      s("Your one thing: drink a glass of water. Go and get it now. I'll be here.", 10000),
      s("Sip it slowly. Feel it go down.", 5000),
      s("Next, stand up and stretch your arms overhead. Slowly.", 6000),
      s("Now sit back down. That's two things done.", 2600),
    ],
  },
  {
    id: "intr-notice", title: "Noticing the thought", blurb: "A thought is just a thought", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Hey. I'm right here. I'm going to talk you through this, one step at a time.", 1300),
      s("You don't have to work the thought out. Not right now.", 2600),
      s("Say to yourself: I'm having a thought.", 3800),
      s("A thought is something your mind is doing. It doesn't need an answer.", 3400),
      s("Don't argue with it. Don't check. Don't go over it again.", 4200),
      s("Let it be there, like a car passing on the street. You don't have to follow it.", 4400),
      s("Now feel your feet on the floor.", 3400),
    ],
  },
  {
    id: "intr-uncertainty", title: "Letting it stay uncertain", blurb: "Maybe, maybe not. Let it sit", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Your mind may be asking for certainty.", 2400),
      s("You don't have to chase that answer. You can let it stay open.", 3400),
      s("Maybe, maybe not. Either way, you can let it sit.", 3800),
      s("Notice the pull to check, or to go over it again. Let the pull be there. Don't follow it.", 5000),
      s("Bring your attention to your hands. Feel what they're touching.", 6000),
      s("Stay with that, for a few slow breaths.", 7000),
    ],
  },
  {
    id: "intr-task", title: "Back to what's in front of you", blurb: "Give your hands something to do", flows: ["intrusive"], status: "needs human review",
    segments: [
      s("Now give your hands something to do.", 2200),
      s("Pick up something nearby. A cup, a pen, your phone.", 4200),
      s("Notice its weight. Notice how it feels.", 5000),
      s("If the thought comes back, that's okay. Come back to the object.", 5000),
      s("Name three sounds around you.", 7000, true),
      s("Good. Your attention is here, in this moment.", 2600),
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
