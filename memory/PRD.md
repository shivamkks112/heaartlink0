# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market. Core focus areas: monetization (Google Play Billing Premium), user safety (AI Selfie Verification, Smart Ban Analytics), AI chatbot enhancements, UI/UX polishing, girl retention features, and core engagement features.

## Auth Rules
- Email OTP is the ONLY allowed authentication method
- Phone OTP is permanently banned

## Tech Stack
- Frontend: React (Capacitor for Android, targeting API 36, minSdk 23)
- Backend: FastAPI + MongoDB
- Real-time: WebSockets
- Push: Firebase Cloud Messaging (FCM)
- Payments: Google Play Billing (`@capgo/native-purchases@8.7.0`)
- AI: Gemini/Claude via `emergentintegrations`
- Ads: AdMob (Capacitor Community Plugin)

## Key Constraints
- Android minSdkVersion = 23 — DO NOT increase
- Premium uses real Google Play Billing — DO NOT mock
- Core pages use eager loading — DO NOT revert
- server.py is 10,600+ lines — needs refactoring

## Completed Features
- [x] All previous features (Premium, AI Verification, Photo Sharing, etc.)
- [x] Duplicate FCM Notification fixes
- [x] Google Play Billing API fixes (isBillingSupported, offerToken, ProGuard)
- [x] 6 Realistic "neutral_real" AI Profiles
- [x] **Profile Prompts (Hinge-style)** — 15 questions, 3 per profile, shown on Discover+Profile (2026-09-19)
- [x] **Ladies First Mode** — Girls-only toggle, enforced in messaging (2026-09-19)
- [x] **Girl Daily Rewards** — HeartCoins system, 2x girl bonus, streak tracking (2026-09-19)
- [x] **Frontend: ProfilePromptsEditor, DailyRewardsWidget, LadiesFirstToggle** (2026-09-19)

## AI Chatbot Personality Types
- `flirty_fun`, `sweet_caring`, `witty_smart`, `neutral_real` (NEW)

## Key New API Endpoints
- `GET /api/profile-prompts/questions` — Get 15 prompt questions
- `POST /api/profile-prompts/{user_id}` — Save prompts (max 3)
- `GET /api/profile-prompts/{user_id}` — Get user's prompts
- `POST /api/user/{user_id}/ladies-first` — Toggle Ladies First (girls only)
- `POST /api/rewards/daily-checkin/{user_id}` — Claim daily reward
- `GET /api/rewards/status/{user_id}` — Get reward status

## Pending / In Progress
- [ ] Server.py Refactoring (P1, deferred)
- [ ] Google Play VKYC verification (User side)

## Upcoming Tasks
- [ ] P1: Virtual Gifts & HeartCoins spending system
- [ ] P1: Profile Prompts on Onboarding flow
- [ ] P1: Girl Referral bonus (extra coins for girl→girl referrals)

## Future/Backlog
- [ ] P2: AI Trust Score algorithm
- [ ] P3: Video Intros (15-second profile videos)
- [ ] P4: Live Location Share
