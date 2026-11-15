# somewhere.

A calm, guided companion for panic, racing thoughts and overwhelm, a voice diary for when you need to talk it out, and a way to find real care. UI built on the "Sanctuary Minimalist" design system (Stitch export).

**Somewhere is a demo and not a medical service or crisis line.** It never diagnoses, never promises to stop an attack, and never replaces qualified care. It cannot place calls or send texts; the 988 and 911 buttons open your phone.

## Run
```bash
npm install
npm run migrate      # schema (migration 004 dropped the old safety-app tables)
npm run audio        # optional: regenerate offline fallback audio
npm run dev          # use Chrome: speech recognition needs it
```
Uses the existing `.env.local` (`DATABASE_URL`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_UNLOCKER_ZONE`, `CRON_SECRET`). No new variables. No Twilio, no SMS or voice APIs.

## Pages
- **In the Moment (`/`)**: tap what your body needs (panic, looping thoughts, sensory overwhelm), optionally where you are. A calm voice tells you what to do, step by step, with no questions. Side panels: *why this works right now* (with source and honest evidence strength), room anchors, live trusted sources, a technique chooser.
- **Between Moments (`/between`)**: consented check-ins, what helps you, history, saved support, **Delete my data**.
- **Voice Diary (`/diary`)**: you talk, it *listens* (a quiet "mm" on pauses, optional one-line reflections, no advice). It then shows "what I heard", you edit it, and save only if you want. Themes, feelings and intensity over time, stored in Neon. Not a chatbot.
- **Find Care (`/care`)**: your city (or location), insurance, care type and budget. Bright Data reads public pages live, Gemini extracts, Neon stores. Every listing is labelled unverified, with the page's own wording, source and checked time, plus a copy-paste outreach message.
- **Crisis Support (`/crisis`)**: 988, Crisis Text Line, Trevor Project, Veterans Crisis Line, international lines, and 3 grounding steps.

## How the in-the-moment guidance works
Browser mic (speech recognition) -> `POST /api/sos/turn` (state machine) -> streamed ElevenLabs TTS. Speaking over it cuts the audio instantly and it resumes from the exact sentence. Directive guidance in a human voice, moving through an evidence-based arc by itself (`docs/EVIDENCE.md`).
- **Safety first**: every utterance goes through deterministic rules plus a Gemini classifier. Self-harm shows 988 and 911; chest pain, fainting or breathing trouble is never treated as anxiety. The Voice Diary checks silently as you talk.
- **Live research (Bright Data + Gemini + Neon)**: at session start, Bright Data searches allowlisted health sites (NHS, NIMH, Mayo Clinic, ADAA, Cleveland Clinic, HelpGuide, others), tailored to where you are; Gemini turns pages into spoken steps plus a "why it works" and anchors; Neon stores them with source and time. Common cases are pre-warmed. Never used for intrusive thoughts (reviewed exercises only).
- **Voices**: ElevenLabs Turbo v2.5, natural pace, next lines preloaded; presets and "a voice you trust" (cloning with consent, deleted at ElevenLabs when you delete). Offline fallback audio in `public/audio`.

## Privacy
Anonymous device cookie, no accounts. No raw audio. No transcripts unless you turn on "keep the full transcript" for a diary entry. Preferences, check-ins and diary entries exist only after you choose them, and **Delete my data** removes everything.

## Sponsors
ElevenLabs (voice, barge-in, cloning) · Gemini (conversation, safety classification, extraction, reflection) · Neon (sessions, preferences, check-ins, diary, provider and technique directory) · Bright Data (live public research for techniques and care).
