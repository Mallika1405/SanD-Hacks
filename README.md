# anchor.

A voice-first companion for panic, intrusive thoughts and overwhelm. It talks you through the moment, keeps a diary that talks back, helps you keep up with therapy, and finds real therapists, clinics and support groups near you. It adapts its tone, advice and layout to what each person is going through.

**Anchor is a demo and not a medical service or crisis line.** It never diagnoses, never promises to stop an attack, and never replaces qualified care. It cannot place calls or send texts; the 988 and 911 buttons open your phone.

## Sponsor tracks: how each one is used

### ElevenLabs (voice is the whole interface)
- **Conversational AI agent ("Juno")**: a real-time voice agent you can interrupt. It runs on a signed URL created by our server, and every conversation starts with dynamic variables: the person's name, conditions, what they said they're going through, what has helped before, a research playbook for their condition, and a summary of their last conversation. It has nine client tools: breathing guide, room anchors, "why it works", trusted-technique lookup, soundscape, crisis resources, tracker logging, page suggestions, and a full timed breathing walkthrough.
- **Text to Speech** (`eleven_multilingual_v2`): the counted, timed breathing walkthrough (SSML pauses between every number), the guided exercises, diary replies, and voice previews. A signed-text proxy means the server can only be made to speak text the server itself produced, so no voice, including a cloned one, can say arbitrary text.
- **A voice library with calming options**: 12 voices (7 tagged calming), assigned separately to Juno, guided exercises and the diary, with an "Extra soothing" setting (slower, steadier). Juno's voice is switched per person with an agent voice override.
- **Instant Voice Cloning**: people can add up to 5 voices (their own or someone they trust) with explicit, timestamped consent. Raw recordings are not stored; deleting a voice removes it at ElevenLabs too.
- **Sound Effects**: calming soundscapes (rain, ocean, forest, warm hum), generated once and cached in Neon.

### Gemini (the brain behind the words)
- The **LLM inside Juno** (Gemini 2.5 Flash through the ElevenLabs agent).
- **Conversation and understanding**: the diary's replies, reading someone's own words and choosing the right kind of help (panic, looping thoughts, overwhelm, or just talk), and conversation summaries.
- **Safety**: a classifier checks what people say alongside deterministic rules. Self-harm shows 988 and 911; chest pain, fainting or breathing trouble is never treated as anxiety. Diary entries get a risk level and trend signals.
- **Extraction and synthesis**: turns pages Bright Data reads into care listings (named therapists, credentials, the clinic they work for, address, insurance wording) and into spoken calming steps; writes each condition's research playbook; summarises layout research; drafts the "what to say when you reach out" message.

### Neon (all the data, in Postgres)
Accounts and profiles, sessions, **saved conversations with Juno** (transcript and summary), diary entries (with risk level and your own words), tracker logs, therapy plans, homework and attendance, voice settings and cloned-voice records, the researched technique library with sources, **condition playbooks with their sources**, per-condition layout settings, the care listings cache (with source URL and checked time), and cached soundscapes. 16 migrations in `migrations/`. "Delete my data" removes everything, and the cloned voices at ElevenLabs.

### Bright Data (live public research)
- **Care search**: the SERP API and Web Unlocker read public pages live for therapists, practices and support groups near you, and Gemini extracts what each page states. Every listing is labelled unverified and shows its source and when it was checked.
- **Calming-technique research**: at the start of a panic or overwhelm conversation, Bright Data reads allowlisted health sites (NHS, NIMH, Mayo Clinic, ADAA, Cleveland Clinic, others) and Gemini turns them into steps with a "why it works". They appear in Juno's Sources tab.
- **Research playbooks per condition**: for panic, OCD, constant worry, social anxiety and stress, Bright Data reads trusted health pages, we add peer-reviewed reviews and trials from PubMed, and Gemini writes what helps in the moment, how to talk with that person, and what to avoid, with every item citing a source (`npm run playbooks`, see `docs/PERSONALIZATION.md`).
- **Layout research**: design guidance per condition found with Bright Data and summarised into settings stored in Neon (`npm run ui:research`).

### Also used
Google Maps Places API (accurate distances and nearby clinics with ratings and phone numbers; OpenStreetMap as a fallback), PubMed E-utilities (study abstracts for the playbooks), Next.js 15, Tailwind, and the `motion` animation library.

## Run
```bash
npm install
npm run migrate      # schema (accounts, conversations, playbooks, therapy, layout, care)
npm run seed         # 5 demo profiles with dummy data (password: somewhere-demo)
npm run playbooks    # build the research playbooks (Bright Data + PubMed + Gemini)
npm run ui:research  # optional: layout research per condition
npm run audio        # optional: generate missing offline fallback audio
npm run dev          # use Chrome: speech recognition needs it
```
Uses `.env.local`: `DATABASE_URL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `GEMINI_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_UNLOCKER_ZONE`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (or `GOOGLE_MAPS_SERVER_KEY`), `CRON_SECRET`. The ElevenLabs key needs Text to Speech, Agents, Sound Effects and Voices (write) permissions. No Twilio, no SMS, no calls.

**Demo logins** (localhost only): `maya_ocd`, `jordan_panic`, `sam_burnout`, `riley_social`, `alex_new`. Password `somewhere-demo`. The guided 3-minute demo is at `/demo`, and the video script is `docs/DEMO_SCRIPT.md`.

## Pages
The app opens on **/login** (account, guest, or demo profile).
- **Today**: greeting, one big help card, a one-tap "how anxious are you" check, anything worth a look from your diary.
- **Talk**: pick what is happening, or tell Juno in your own words. Juno talks with you live and can walk you through breathing. A scripted guide runs if the live agent is unavailable.
- **Diary**: a real conversation by voice or text. It keeps your own words, and flags worrying entries with 988, 911 and a note to copy for your therapist.
- **Tracker**: OCD urges, panic episodes and daily mood, one question at a time, with insights.
- **Therapy**: your plan, next session, "did you go?", what to bring, homework checklist, attendance.
- **Care**: one question at a time, then named therapists with the clinic they work for, distance, phone and address; clinics; and support groups. Everything is unverified.
- **You**: profile, voices, light and dark mode, layout settings with the reasons behind them, saved conversations, **Delete my data**.
- **Crisis**: static 988, 911 and other resources, always reachable.

## How it adapts to each person
Tone, questions, suggested voice and layout depend on what someone is working through (`lib/personas.ts`, `lib/playbooks.ts`, `lib/ui.ts`). The research behind each choice, and its limits, is in `docs/PERSONALIZATION.md`. Notably: there is no good evidence that one color or voice calms one condition more than another, so those are defaults the person can change.

## Privacy
An anonymous device or a username and password account (no email). No raw audio is stored. Conversations with Juno and diary words are saved to your own history by default, with a switch to turn each off, and you can read or delete any of them. Cloned voices need consent and are deleted at ElevenLabs when you delete them or your data.
