# Haven

Voice-first safety companion (SanD Hacks). Haven never replaces 911 and never places a real 911 call.

## Setup
```bash
cp .env.example .env.local     # fill in keys (all optional except DATABASE_URL to start)
npm install
npm run migrate                # creates schema (PostGIS)
npm run seed                   # demo user, 3 contacts, demo places + heat
npm run prewarm                # optional: cache real places around UCSD (Overpass / Places / Bright Data + Gemini)
npm run dev
```
Set `SEED_PHONE_1..3` to real numbers before `npm run seed` for live calls.

## Keys
| Var | Used for |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `TWILIO_*`, `APP_BASE_URL` | calls/SMS. Webhook base must be public https (ngrok or Vercel). Set the number's SMS webhook to `/api/twilio/sms` |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` | voice agent. Prompt + tools: `docs/ELEVENLABS_AGENT_PROMPT.md` |
| `GEMINI_API_KEY` | extraction of hours, evidence chips |
| `BRIGHTDATA_*` | venue page + SERP fetch |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | optional: Places + Directions. Without it: Overpass + OSM foot routing. Map tiles are MapLibre either way |
| `BLOB_READ_WRITE_TOKEN` | audio clips |
| `CRON_SECRET` | protects `/api/safe-places/refresh` (daily Vercel cron) |

No keys? Everything degrades: Twilio runs in dry-run (use /dev "Press 1"), voice shows a typed fallback, places come from the demo seed.

## Demo
`/demo` has shortcuts. `/?sim=route1` starts the GPS simulator (Geisel → Pepper Canyon). In the console: `__haven.deviate()`, `__haven.stop()`.

## Safety design
- Alert engine reads only Neon. No scraping/LLM/maps in the alert path.
- Webhooks validate Twilio signatures and are idempotent (`webhook_events`). Atomic claim: `UPDATE ... WHERE claimed_by IS NULL`.
- Mic/GPS only during an active session. 60s rolling buffer in memory; clips/transcript saved only after Followed / Fake call / Alert.
- Contacts opt in by SMS reply YES. Responder links are tokenized and expire (6h). Alerts are neutral and cancellable.
- Hackathon caveat: no user auth; the single seeded user is the app user.
