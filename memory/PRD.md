# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market. Core focus areas: monetization (Google Play Billing Premium), user safety (AI Selfie Verification, Smart Ban Analytics), AI chatbot enhancements (Custom Personas, Spam/Emoji reduction), UI/UX polishing, and core engagement features (Photo sharing in chat).

## Auth Rules
- Email OTP is the ONLY allowed authentication method
- Phone OTP is permanently banned

## Tech Stack
- Frontend: React (Capacitor for Android, targeting API 36, minSdk 23)
- Backend: FastAPI + MongoDB
- Real-time: WebSockets
- Push: Firebase Cloud Messaging (FCM)
- Payments: Google Play Billing (`@capgo/native-purchases@8.7.0`)
- AI: Gemini/Claude via `emergentintegrations` (chat, moderation, selfie verification)
- Ads: AdMob (Capacitor Community Plugin)

## Key Constraints
- Android minSdkVersion = 23 (API 23, Android 6.0) — DO NOT increase
- Premium uses real Google Play Billing — DO NOT mock
- Core pages use eager loading (no Suspense/lazy) — DO NOT revert
- server.py is 10,600+ lines — needs refactoring into /app/backend/routes/

## Completed Features
- [x] Auto-Unban Timer + Smart Ban Analytics Chart (Admin Panel)
- [x] Custom AI Persona + Admin Toggle
- [x] AI Chatbot Spam Reduction (no double messaging, minimal emojis)
- [x] System Safety Warnings (red in-chat bubbles)
- [x] Chat Profile Navigation Bug Fix
- [x] Matches/Active/Messages tabs instant switch (eager loading)
- [x] AI Photo Verification System (Selfie match via Gemini)
- [x] Verified User Ranking Bonus (+50 Discover score)
- [x] Android Safe-Area Inset Fixes
- [x] AdMob Ad Fix (gender capitalization bug)
- [x] Google Play Billing Premium (Rs49/month, 3-day trial, RTDN webhooks)
- [x] Premium Analytics Widget (Admin Dashboard)
- [x] Android API 23 compatibility restored
- [x] In-Chat Photo Sharing (Emergent Object Storage + Gemini Vision moderation)
- [x] Profile Page Premium Golden Card Upsell
- [x] Like/Superlike Notification Deduplication
- [x] Duplicate FCM Fix — Messages + Verification
- [x] Google Play Billing API fixes (isBillingSupported, offerToken, ProGuard)
- [x] **6 Realistic "neutral_real" AI Profiles** (Ayesha, Radhika, Tara, Pooja, Megha, Kriti) — 2026-09-18
- [x] **Enhanced emotional safety rules** for all AI chatbot profiles — 2026-09-18

## AI Chatbot Personality Types
- `flirty_fun` — Playful, teasing, confident
- `sweet_caring` — Caring, emotional, supportive
- `witty_smart` — Sharp, sarcastic, intellectual
- `neutral_real` — **NEW** — Normal, realistic, supportive, minimal emojis, no over-flirting

## Pending / In Progress
- [ ] Server.py Refactoring (P1, deferred) — Break into /app/backend/routes/
- [ ] Google Play VKYC verification (User side - pending)

## Upcoming Tasks (P1)
- [ ] Virtual Gifts & HeartCoins — In-app currency for virtual gifts

## Future/Backlog
- [ ] P2: AI Trust Score algorithm
- [ ] P3: Video Intros (15-second profile videos)
- [ ] P4: Live Location Share (Capacitor/App update required)

## Known Recurrence Patterns
- Phone OTP must stay removed
- New admin endpoints must use Depends(require_admin)
- Duplicate FCM triggers — always check both legacy and modern paths
- After installing new Capacitor plugins, run `npx cap sync android`
- ProGuard rules must be added for new native libraries
- `@capgo/native-purchases` field names differ from common assumptions — always check type definitions
