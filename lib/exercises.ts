import type { Seg } from "./speech";

export type Flow = "panic" | "intrusive" | "overwhelm" | "unsure";
export type Exercise = {
  id: string; title: string; blurb: string; flows: Exclude<Flow, "unsure">[]; status: "needs human review"; segments: Seg[];
};

// DIRECTIVE guidance in a human voice: short, warm, spoken-style sentences. No questions, no waiting. See docs/EVIDENCE.md.
const s = (text: string, pause_ms = 1500, listen = false): Seg => ({ text, pause_ms, ...(listen ? { listen } : {}) });

/** Cyclic sighing (double inhale through the nose, long exhale): the best-supported in-the-moment breathing. Gentle, never forced. Counted out loud. */
const br = (ms: number) => `<break time="${ms / 1000}s" />`;
const round = (tail: string): Seg[] => [
  s(`Breathe in through your nose. ${br(700)} Two. ${br(500)} And one more small sip of air.`, 250),
  s(`Now out through your mouth, slowly. ${br(600)} Two. ${br(650)} Three. ${br(650)} Four. ${br(650)} Five. ${br(650)} Six. ${tail}`, 500),
];

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
    id: "exhale-breath", title: "Slow breathing", blurb: "Long exhale, counted out loud", flows: ["panic", "overwhelm", "intrusive"], status: "needs human review",
    segments: [
      s("Here's what we're going to do. Breathe in through your nose for about two seconds. Then one more small sip of air. Then let it out slowly through your mouth for about six. I'll count it with you.", 900),
      ...round("That's it."), ...round("Again."), ...round("You're doing it."), ...round("Nice and slow."), ...round("Once more."),
      s("Keep that slow rhythm going for as long as you like.", 2000),
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
    id: "cold-reset", title: "Cold water reset", blurb: "Cool your face to slow your body", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Okay. Your body is running hot with adrenaline. Let's cool it down.", 1600),
      s("If you can, go to a sink. Run cold water over your wrists, or splash your face. Or hold something cold against your cheeks, like a cold can or a damp cloth.", 6000),
      s("Cold on the face tells your body to slow your heart rate down. It's a reflex, so it works even if your mind is racing.", 5000),
      s("Hold it there. And breathe out slowly.", 5200),
      s("Keep it there for about thirty seconds. Nothing else to do.", 7000),
      s("If you can't get to water, press your palms to something cool, like a window or a tile floor.", 5500),
    ],
  },
  {
    id: "push-wall", title: "Push it out", blurb: "Use the adrenaline, then drop it", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Your body is full of energy it doesn't need. Let's use it up.", 1600),
      s("Stand up, and put both hands flat on a wall. Feet back, a little behind you.", 4500),
      s("Now push into the wall as hard as you can. Really push. Hold it.", 6000),
      s("And let go. Shake out your arms. Breathe out.", 4500),
      s("Once more. Push hard into the wall. Hold it.", 6000),
      s("And drop it. Let your shoulders fall. Slow breath out.", 5000),
      s("That tight, buzzy feeling is adrenaline, and you just burned some of it off.", 3500),
    ],
  },
  {
    id: "count-breath", title: "Count it with me", blurb: "Four rounds of slow, counted breathing", flows: ["panic", "overwhelm"], status: "needs human review",
    segments: [
      s("Stay with me. We're going to breathe together, and I'll count every one.", 1800),
      s(`Breathe in through your nose. ${br(700)} Two. ${br(600)} Three. ${br(600)} Four.`, 400),
      s(`Out through your mouth, slowly. ${br(600)} Two. ${br(650)} Three. ${br(650)} Four. ${br(650)} Five. ${br(650)} Six. ${br(650)} Seven.`, 900),
      s(`Again. In through your nose. ${br(700)} Two. ${br(600)} Three. ${br(600)} Four.`, 400),
      s(`And out. ${br(650)} Two. ${br(650)} Three. ${br(650)} Four. ${br(650)} Five. ${br(650)} Six. ${br(650)} Seven.`, 900),
      s(`One more. In. ${br(700)} Two. ${br(600)} Three. ${br(600)} Four.`, 400),
      s(`And out. ${br(650)} Two. ${br(650)} Three. ${br(650)} Four. ${br(650)} Five. ${br(650)} Six. ${br(650)} Seven.`, 900),
      s("Good. Keep that out-breath long, longer than the in-breath. That's what slows your heart.", 3000),
    ],
  },
  {
    id: "what-is-happening", title: "What your body is doing", blurb: "It's adrenaline, and it has a peak", flows: ["panic"], status: "needs human review",
    segments: [
      s("I want you to know what's happening, because it's less scary when you do.", 1800),
      s("Your body hit its alarm. It released adrenaline, so your heart pounds, your breathing speeds up, and you might feel shaky or dizzy.", 3800),
      s("It feels dangerous, but it's your body trying to protect you. It can't keep that level up. Adrenaline peaks within a few minutes and then it starts to fall.", 4500),
      s("Fighting it feeds it. So we let the wave come, and we keep breathing out slowly.", 3800),
      s("You've gotten through this before, and you're getting through it right now.", 3000),
      s("Breathe out, long and slow.", 5000),
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
  panic: ["orient-posture", "exhale-breath", "name-it", "what-is-happening", "ground-54321", "cold-reset", "push-wall", "count-breath", "muscle-release", "ride-wave"],
  overwhelm: ["ow-settle", "exhale-breath", "ow-orient", "ow-one-thing", "cold-reset", "count-breath", "muscle-release", "ground-54321"],
  intrusive: ["intr-notice", "exhale-breath", "intr-uncertainty", "intr-task", "ground-54321"],
};
export const getExercise = (id: string) => EXERCISES.find((e) => e.id === id)!;

/** Plain-language "why this works" (with how strong the evidence really is) and room anchors for each reviewed technique. */
export const META: Record<string, { why: string; anchors: string[]; source?: { name: string; url: string } }> = {
  "orient-posture": { why: "Panic usually rises, peaks and eases, and fighting it tends to feed it. Letting your body settle while the wave passes is a standard first step in self-help guidance for panic. It won't stop the feeling instantly.", anchors: ["Both feet flat on the floor", "Shoulders dropped away from your ears", "Jaw unclenched, hands open"], source: { name: "Rethink Mental Illness", url: "https://rethink.org/advice-and-information/about-our-advice-service/get-help-now/self-help-guides/how-do-i-manage-a-panic-attack" } },
  "exhale-breath": { why: "A longer exhale is one of the best-studied ways to slow your breathing. In a 2023 randomized trial, exhale-focused breathing improved mood and slowed breathing more than mindfulness. It was daily practice, the effect was modest, and it is not a cure.", anchors: ["In through your nose", "A second small sip of air", "A long, slow exhale through your mouth"], source: { name: "Balban et al., 2023", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947" } },
  "name-it": { why: "Putting a feeling into words, like \"this is anxiety\", quieted the brain's alarm response in a small imaging study. That shows how it may work, not that it's a proven treatment.", anchors: ["Say it: this is anxiety", "Notice where you feel it", "Let it be there"], source: { name: "Lieberman et al., 2007", url: "https://sites.lifesci.ucla.edu/psych-sanlab/wp-content/uploads/sites/31/2016/03/Lieberman_2007_PsychScience.pdf" } },
  "ground-54321": { why: "Grounding moves your attention from alarming thoughts to what's around you. It's recommended in psychological first aid guidance, which is expert consensus rather than trial data.", anchors: ["Five things you can see", "Four things you can feel", "Three things you can hear"], source: { name: "SAMHSA Psychological First Aid", url: "https://webarchive.library.unt.edu/eot2008/20080916143942/http://mentalhealth.samhsa.gov/Disasterrelief/pubs/manemotion.asp" } },
  "muscle-release": { why: "Tensing and then releasing muscle groups is a standard relaxation technique used for anxiety. It gives your body something to do with the tension.", anchors: ["Squeeze both fists, then let go", "Shoulders up, then drop", "Press your feet down, then release"] },
  "ride-wave": { why: "Acceptance-based approaches suggest letting the sensations rise and pass instead of fighting them. Fighting a wave tends to make it feel bigger.", anchors: ["Watch the wave rise", "Breathe out slowly", "Stay with the next exhale"] },
  "cold-reset": { why: "Cool water or a cold pack on the face triggers the dive reflex, which slows the heart rate. It is used in some medical and self-help settings for racing heart. If you have a heart condition or any fainting history, check with your doctor before using it.", anchors: ["Cold water on wrists or face", "Or something cold on your cheeks", "Hold it, and breathe out slowly"] },
  "push-wall": { why: "Panic leaves you full of adrenaline with nowhere to put it. Strong muscle effort, followed by release, uses some of that energy and gives your body something to do. It is common in self-help guidance for panic rather than a proven treatment.", anchors: ["Hands flat on a wall", "Push hard, hold", "Let go, shake your arms out"] },
  "count-breath": { why: "A longer out-breath than in-breath slows your breathing, and counting gives your mind something steady to hold. Exhale-focused breathing has some of the best evidence among quick calming techniques, with modest effects.", anchors: ["In through your nose for four", "Out through your mouth for seven", "Longer out than in"] },
  "what-is-happening": { why: "Understanding that panic is an adrenaline surge that peaks and falls takes away the fear of the fear. Explaining this is a standard first part of treatment for panic. It won't stop the feeling instantly.", anchors: ["It's adrenaline", "It peaks, then it falls", "It can't hurt you"] },
  "ow-settle": { why: "When everything feels like too much, stopping and settling your body first lowers the pressure to solve it all at once.", anchors: ["Hands down, nothing to do", "Both feet on the floor", "Shoulders dropped"] },
  "ow-orient": { why: "Looking around and naming what you see brings your attention back to the room instead of the pile of worries.", anchors: ["Three things you can see", "The colors and shapes", "The surface under your hands"], source: { name: "SAMHSA Psychological First Aid", url: "https://webarchive.library.unt.edu/eot2008/20080916143942/http://mentalhealth.samhsa.gov/Disasterrelief/pubs/manemotion.asp" } },
  "ow-one-thing": { why: "Shrinking everything down to one small, doable step makes it easier to start, and it breaks the freeze of feeling overloaded.", anchors: ["A glass of water", "Sip it slowly", "Stretch your arms overhead"] },
  "intr-notice": { why: "Treating a thought as just a thought, something your mind is doing, helps you stop arguing with it. This is a principle from acceptance-based therapy, not a treatment.", anchors: ["Say: I'm having a thought", "Don't argue, don't check", "Let it pass like a car"] },
  "intr-uncertainty": { why: "With unwanted thoughts, searching for certainty or reassurance can keep the loop going. Letting the question stay open is a core idea in therapy for these patterns, which works best with a trained clinician.", anchors: ["Maybe, maybe not", "Notice the pull to check", "Feel what your hands touch"] },
  "intr-task": { why: "Giving your hands and attention something concrete in front of you pulls focus back to the present without engaging with the thought.", anchors: ["Hold an object", "Notice its weight", "Name three sounds"] },
};
export const getMeta = (id: string) => META[id];
