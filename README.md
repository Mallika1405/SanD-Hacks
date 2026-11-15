# somewhere.

A calm, interruptible voice for panic, intrusive thoughts and overwhelm, then a path to real, sourced care.

**Somewhere is a demo and not a medical service or crisis line.** It never diagnoses, never promises to stop an attack, and never replaces qualified care.

## Run
```bash
npm install
npm run migrate      # creates the schema (migration 004 drops the old safety-app tables)
npm run audio        # optional: regenerate the offline fallback audio in public/audio
npm run dev          # use Chrome: speech recognition needs it
```
Uses the env vars already in `.env.local`: `DATABASE_URL`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_UNLOCKER_ZONE`, `CRON_SECRET`. Optional: `GEMINI_MODEL`. No Twilio, no SMS/voice APIs, no server-initiated calls or texts.

Open `/demo` for a scripted simulated anxiety episode.

## How it works
- **SOS (`/session`)**: browser mic (speech recognition) -> `POST /api/sos/turn` (state machine: start, support, adapt, finish, follow-up, crisis; Gemini inside it) -> streamed ElevenLabs TTS (`eleven_flash_v2_5`). Speaking over it cuts the audio instantly (barge-in); it resumes from the exact sentence.
- **Safety first**: every utterance goes through deterministic rules plus a Gemini classifier before anything else. Self-harm shows 988 (call/text) and 911; chest pain, fainting or breathing trouble is never treated as anxiety. The app never places a call: the buttons open the phone's dialer. `npm run test:agent` checks sample risk phrases.
- **Directive guidance, no questions**: it tells her what to do, step by step, and moves to the next technique on its own (about 8 blocks, then a closing). She can interrupt, but never has to. The only question it can ask is a safety question when she mentions a possible emergency symptom. Research and limits: `docs/EVIDENCE.md`.
- **Live research (Bright Data)**: the moment a session starts, Bright Data searches allowlisted health sources (NHS, NIMH, Mayo Clinic, ADAA, Cleveland Clinic, HelpGuide and others), Gemini turns the pages into short spoken steps, and Neon stores them with `source_url` and `checked_at`. It runs in the background so the first seconds are never slowed; the first technique is always a reviewed one. Researched techniques are labelled "not reviewed by a clinician" and are never used for intrusive thoughts.
- **Exercises** live in `lib/exercises.ts`, all marked `needs human review`. Gemini may rephrase for tone only. Intrusive-thought flow never reassures about the thought's content.
- **Voices**: 4 calm ElevenLabs presets, plus "a voice you trust" (instant clone, consent timestamped, labelled in-session, can only speak signed reviewed text, deleted at ElevenLabs when you delete).
- **Fallback audio**: `public/audio` is pre-generated for the welcome, safety messages and three core exercises.
- **Support (`/care`)**: when she searches, Bright Data finds public pages for her answers, Gemini extracts providers and groups, Neon stores them with `source_url`, `checked_at`, `verified=false`. Results stream in live. Insurance, cost and availability are always labelled unverified.
- **Check-ins, history, preferences**: only after she says yes. `/me` shows them and has **Delete my data**.

## Privacy
Anonymous device cookie, no accounts. No raw audio and no stored transcripts: the last few turns live only in the session row while it is active and are purged when it ends. Preferences are stored only after consent.

## Sponsors
ElevenLabs (live voice, barge-in, TTS, preset and cloned voices, fallback audio) · Gemini (dialogue, safety classification, matching, extraction) · Neon (sessions, consented preferences, check-ins, provider and group directory) · Bright Data (live public provider and group discovery with sources and freshness; affordable-care angle for Data for Good).
