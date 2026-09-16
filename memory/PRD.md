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
- Payments: Google Play Billing (`@capgo/native-purchases`)
- AI: Gemini/Claude via `emergentintegrations` (chat, moderation, selfie verification)
- Ads: AdMob (Capacitor Community Plugin)

## Key Constraints
- Android minSdkVersion = 23 (API 23, Android 6.0) — DO NOT increase
- Premium uses real Google Play Billing — DO NOT mock
- Core pages use eager loading (no Suspense/lazy) — DO NOT revert
- server.py is 10,600+ lines — needs refactoring into /app/backend/routes/

## Completed Features (All Tested)
- [x] Auto-Unban Timer + Smart Ban Analytics Chart (Admin Panel)
- [x] Custom AI Persona (shivamkks545@gmail.com) + Admin Toggle
- [x] AI Chatbot Spam Reduction (no double messaging, minimal emojis)
- [x] System Safety Warnings (red in-chat bubbles)
- [x] Chat Profile Navigation Bug Fix (double /api/api/ fallback)
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
- [x] Duplicate FCM Fix — Messages (WS trigger removed)
- [x] Duplicate FCM Fix — Verification approve/reject (Legacy calls removed, 2026-09-16)
- [x] Selfie Verification reject FCM modernized (2026-09-16)
- [x] Google Play Billing Android registration fix — cap sync + ProGuard rules (2026-09-16, APK rebuild needed)

## Pending / In Progress
- [ ] Server.py Refactoring (P1, deferred) — Break into /app/backend/routes/

## Upcoming Tasks (P1)
- [ ] Virtual Gifts & HeartCoins — In-app currency for virtual gifts

## Future/Backlog
- [ ] P2: AI Trust Score algorithm
- [ ] P3: Video Intros (15-second profile videos)
- [ ] P4: Live Location Share (Capacitor/App update required)

## Key API Endpoints
- `/api/google-play/verify` — Play Billing verification
- `/api/webhooks/google-play` — RTDN webhook
- `/api/user/submit-selfie-verification-ai` — Selfie verification
- `/api/messages` — Chat messages (supports image_base64)
- `/api/fcm/register-token` — FCM token registration
- `/api/admin/verify-selfie` — Admin selfie verification

## Key DB Collections
- `users`: is_premium, subscription_status, premium_end_date, selfie_verification_status, custom_ai_persona, fcm_token
- `messages`: match_id, sender_id, receiver_id, content, image fields
- `matches`: user1_id, user2_id, matched, is_superlike, compatibility_score
- `safety_reports`: Ban tracking metrics
- `in_app_notifications`: user_id, title, body, type, data

## Known Recurrence Patterns
- Phone OTP must stay removed
- New admin endpoints must use Depends(require_admin)
- Duplicate FCM triggers when adding new notification paths — always check both legacy and modern paths
- After installing new Capacitor plugins, always run `npx cap sync android` to register them
- ProGuard rules must be added for any new native library in release builds
