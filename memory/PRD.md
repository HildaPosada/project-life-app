# Project Life — Product Requirements Document (v1 MVP)

## Vision
Project Life is a trauma-informed emotional intelligence companion designed to guide users through a 2.2-year self-directed healing arc that integrates with — but does not replace — external therapy.

## Target users
Individuals actively in or seeking therapy, working through trauma, EMDR, somatic, and/or ketamine-assisted modalities. Low-cost ($20/month goal), remote-first.

## Core value
- Structured, unhurried, safe digital sanctuary.
- Bridges the space between therapy sessions.
- Private, encrypted, self-owned.

## MVP scope (this build)
All 4 phases scaffolded with lock/unlock progression:
- **Phase 0** – Groundwork (consent, safety net, orientation)
- **Phase 1** – Talk Therapy Foundations (weekly check-ins, therapist uploads)
- **Phase 2** – EMDR Processing (memories bank — requires EMDR approval upload)
- **Phase 3** – Somatic + Ketamine Integration (session logs)

## Features shipped
### Auth
- Emergent-managed Google OAuth (`https://auth.emergentagent.com/`)
- Session tokens stored in `expo-secure-store` on mobile / `localStorage` on web
- 7-day session expiry with TTL cleanup

### Onboarding
- 4-step flow: welcome → profile (pronouns, location) → therapist status → consent
- Onboarding gates access to the tabs

### Home tab
- "Do you feel safe today?" safety check card (routes to Safety Net)
- Current phase card with progress
- Quick actions: weekly reflection, journal entry
- Stats: entries, check-ins, phase

### Vault tab
- **Journal** sub-tab: list of entries with mood word chip and date
- **Insights** sub-tab: entry count, avg mood, weekly check-ins, therapist uploads, top emotional words
- FAB to create new entry
- Journal entry composer: title, body, mood word chips (10 options), mood score 1-5

### Journey tab
- Vertical phase timeline (0 → 3) with locked/unlocked/current states
- Tap phase → detail screen with description, progress, requirements
- Phase 2: memories bank input + list
- Phase 3: session-log entry point
- Advance-phase button when progress == 100%
- Trauma Map events (landmarks) — user-added, list + composer

### Library tab
- Somatic practice list (8 seeded) filtered by category chips (All / Breathing / Grounding / Body Awareness / EMDR pre-work)
- Practices locked based on current phase
- Therapist uploads: add filename, kind (weekly_summary / release_form / emdr_approval / other), notes

### Safety Net
- "Do you feel safe today?" answer flow (yes/no + optional note)
- Emergency contacts (add / call / delete)
- Crisis resources list (988, Crisis Text Line, IASP, SAMHSA)

### Session log composer (Phase 3)
- Session type, body experience, insights, integration notes

## Design system
- Palette: warm off-whites, sage greens (`#7C8D7C`), soft clays (`#B78775`). No blue/purple.
- Typography: Georgia/serif fallback for display, System sans for body.
- Radius: pill for buttons, md/lg for cards. Shadow tier 0 (matte paper).
- Bottom-tab nav, 4 tabs.

## Tech stack
- Backend: FastAPI, MongoDB (motor), httpx for OAuth verification, Pydantic v2.
- Frontend: Expo Router SDK 54, React Native, `expo-secure-store`, `expo-linear-gradient`, `expo-haptics`, `@expo/vector-icons` (Feather).
- Auth: Emergent Google OAuth (`auth.emergentagent.com`).

## Deferred / Not in this MVP
- LLM-powered "GPT companion" reflections (user opted out to keep costs down).
- AI pattern recognition and progress evaluator (deterministic progress used instead).
- File upload of PDFs / voice memos (references and notes only; base64 storage stub in schema).
- Push notifications.
- Therapist-side portal.
