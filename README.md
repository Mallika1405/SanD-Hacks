# somewhere.

A calm, guided companion for panic, racing thoughts and overwhelm, a voice diary for when you need to talk it out, and a way to find real care. UI built on the "Sanctuary Minimalist" design system (Stitch export).

**Somewhere is a demo and not a medical service or crisis line.** It never diagnoses, never promises to stop an attack, and never replaces qualified care. It cannot place calls or send texts; the 988 and 911 buttons open your phone.

## Run
```bash
npm install
npm run migrate      # schema, incl. accounts, therapy and layout tables
npm run seed         # 5 demo profiles with dummy data (password: somewhere-demo)
npm run ui:research  # optional: re-research layout settings per condition (Bright Data + Gemini)
npm run audio        # optional: generate missing offline fallback audio
npm run dev          # use Chrome: speech recognition needs it
```
Uses `.env.local` (`DATABASE_URL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `GEMINI_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_UNLOCKER_ZONE`, `CRON_SECRET`). The ElevenLabs key needs Text to Speech, Agents and Sound Effects permissions. No Twilio, no SMS or voice APIs.

**Demo logins** (localhost only): `maya_ocd`, `jordan_panic`, `sam_burnout`, `riley_social`, `alex_new`. Password `somewhere-demo`.

## Pages
The app opens on **/login** (account, guest, or demo profile). Everything else needs you to have entered.
- **Today (`/`)**: greeting, a one-tap "how anxious are you" check, anything worth a look from your diary, and a short list.
- **Talk (`/now`)**: pick what is happening; Juno, a live ElevenLabs voice agent (Gemini), talks with you and guides you. A scripted fallback guide runs if the live agent is unavailable.
- **Diary (`/diary`)**: a real conversation. Talk or write; it answers, asks a gentle follow-up, and offers a small idea when you are struggling. Your own words are saved with the entry (switch it off per entry if you prefer). Each entry gets a risk level; worrying entries and trends show 988, 911 and a note to copy for your therapist.
- **Tracker (`/tracker`)**: OCD urges, panic episodes, daily mood, with insights.
- **Therapy (`/therapy`)**: your plan, next session, "did you go?", what to bring, homework checklist, attendance.
- **Find care (`/care`)**: city, insurance, care type. Bright Data reads public pages live, Gemini extracts, Neon stores. Every listing is labelled unverified, with an outreach script.
- **You (`/you`)**: profile, layout settings with the reasons behind them, check-ins, saved support, **Delete my data**.
- **Crisis (`/crisis`)**: static 988, 911 and other resources. Always reachable.

## Layout per condition
Each condition has defaults for spacing, movement, palette, text size and how much is on screen. `npm run ui:research` has Bright Data find public design guidance and Gemini summarise it into settings stored in Neon (`ui_profiles`). A palette only changes from the default if two sources agree. You can override anything on `/you`. This is design guidance, not medical advice.

## How the in-the-moment guidance works
Browser mic (speech recognition) -> `POST /api/sos/turn` (state machine) -> streamed ElevenLabs TTS. Speaking over it cuts the audio instantly and it resumes from the exact sentence. Directive guidance in a human voice, moving through an evidence-based arc by itself (`docs/EVIDENCE.md`).
- **Safety first**: every utterance goes through deterministic rules plus a Gemini classifier. Self-harm shows 988 and 911; chest pain, fainting or breathing trouble is never treated as anxiety. The Voice Diary checks silently as you talk.
- **Live research (Bright Data + Gemini + Neon)**: at session start, Bright Data searches allowlisted health sites (NHS, NIMH, Mayo Clinic, ADAA, Cleveland Clinic, HelpGuide, others), tailored to where you are; Gemini turns pages into spoken steps plus a "why it works" and anchors; Neon stores them with source and time. Common cases are pre-warmed. Never used for intrusive thoughts (reviewed exercises only).
- **Voices**: ElevenLabs Turbo v2.5, natural pace, next lines preloaded; presets and "a voice you trust" (cloning with consent, deleted at ElevenLabs when you delete). Offline fallback audio in `public/audio`.

## Privacy
Anonymous device or a username and password account (no email). No raw audio. No transcripts unless you turn on "keep the full transcript" for a diary entry. Preferences, check-ins and diary entries exist only after you choose them, and **Delete my data** removes everything.

## Sponsors
ElevenLabs (voice, barge-in, cloning) · Gemini (conversation, safety classification, extraction, reflection) · Neon (sessions, preferences, check-ins, diary, provider and technique directory) · Bright Data (live public research for techniques and care).
