// Calm preset voices from the ElevenLabs default library (chosen from their descriptions; audition and swap as you like).
export const PRESETS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", blurb: "Reassuring and warm" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", blurb: "Relaxed and neutral" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", blurb: "Deep and comforting" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", blurb: "Soft and velvety" },
];
export const DEFAULT_VOICE = PRESETS[0].id;
export const SAMPLE_LINE = "Let's slow down together. Breathe in gently, and let it out. You're doing fine.";

// More expressive than Flash, still fast. Natural pace (speed 1.0), some style so it sounds like a person, not a reader.
export const TTS_MODEL = "eleven_multilingual_v2";
export const TTS_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.97 };
