# somewhere.

A calm, interruptible voice for panic, intrusive thoughts and overwhelm, then a path to real, sourced care.
**Somewhere is a demo and not a medical service or crisis line.** It never diagnoses and never replaces qualified care.

## Run
```bash
npm install
npm run migrate     # creates the schema (drops the old safety-app tables)
npm run dev
```
Env (already in `.env.local`): `DATABASE_URL`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_UNLOCKER_ZONE`, `CRON_SECRET`.

## Sponsors
- **ElevenLabs**: streamed TTS (Flash v2.5), preset and cloned voices (with consent), pre-generated fallback audio.
- **Gemini**: dialogue inside a state machine, safety classification, matching, extraction.
- **Neon**: sessions, consented preferences, check-ins, provider and group directory.
- **Bright Data**: public provider and group discovery with sources and freshness.

No Twilio, no SMS/voice APIs, no server-initiated calls or texts. All voice happens in the browser.
