// Calm preset voices from the ElevenLabs default library (chosen from their descriptions; audition and swap as you like).
export type VoiceOption = { id: string; name: string; blurb: string; tags: string[]; calming?: boolean };
export const PRESETS: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", blurb: "Reassuring and warm", tags: ["Woman", "American"], calming: true },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", blurb: "Soft and velvety", tags: ["Woman", "British"], calming: true },
  { id: "cuTixVvCOWFxeH3oGE9m", name: "Clara", blurb: "Calm and reassuring, like a care coordinator", tags: ["Woman", "American"], calming: true },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", blurb: "Relaxed and neutral", tags: ["Neutral", "American"], calming: true },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", blurb: "Deep and comforting", tags: ["Man", "American"], calming: true },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", blurb: "Wise, mature, balanced", tags: ["Man", "American"], calming: true },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", blurb: "Warm storyteller, like being read to", tags: ["Man", "British"], calming: true },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", blurb: "Smooth and trustworthy", tags: ["Man", "American"] },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", blurb: "Clear and friendly", tags: ["Woman", "British"] },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", blurb: "Bright and warm", tags: ["Woman", "American"] },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", blurb: "Relaxed and easygoing", tags: ["Man", "American"] },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", blurb: "Down to earth, like a friend", tags: ["Man", "American"] },
];
export const DEFAULT_VOICE = PRESETS[0].id;
export const SAMPLE_LINE = "Let's slow down together. Breathe in gently, and let it out. You're doing fine.";

// More expressive than Flash, still fast. Natural pace (speed 1.0), some style so it sounds like a person, not a reader.
export const TTS_MODEL = "eleven_multilingual_v2";
export const TTS_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.97 };

// "Extra soothing": steadier, softer, a little slower.
export const TTS_SETTINGS_SOOTHING = { stability: 0.65, similarity_boost: 0.8, style: 0.1, use_speaker_boost: false, speed: 0.88 };
export type VoiceTarget = "companion" | "guide" | "diary";
