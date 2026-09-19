# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market focusing on girl retention, safety, monetization (Google Play Billing), AI chatbot engagement, and real user growth.

## Auth: Email OTP ONLY (Phone OTP permanently banned)

## Tech Stack
React + FastAPI + MongoDB + Capacitor (Android API 36, minSdk 23) + WebSockets + FCM + Google Play Billing + Gemini/Claude AI + AdMob

## Completed Features (Latest First)
- [x] **Profile Prompts on Onboarding** — Conversation starters during signup (2026-09-19)
- [x] **Safety Score Badge** — Green/Yellow safety indicator on discover cards (2026-09-19)
- [x] **Profile Prompts on UserProfilePage** — View prompts when viewing profiles (2026-09-19)
- [x] Profile Prompts (Hinge-style) — 15 questions, editable on Profile page (2026-09-19)
- [x] Ladies First Mode — Girls-only toggle, enforced in messaging (2026-09-19)
- [x] Girl Daily Rewards — HeartCoins, 2x girl bonus, streak tracking (2026-09-19)
- [x] 6 Realistic "neutral_real" AI Profiles (2026-09-18)
- [x] Enhanced emotional safety rules for AI chatbot (2026-09-18)
- [x] Google Play Billing API fixes (isBillingSupported, offerToken, ProGuard) (2026-09-16)
- [x] Duplicate FCM fixes — Messages + Verification (2026-09-16)
- [x] All previous features (Premium, AI Verification, Photo Sharing, etc.)

## Key New Endpoints
- `GET/POST /api/profile-prompts/{user_id}` — Profile conversation starters
- `POST /api/user/{user_id}/ladies-first` — Ladies First toggle (girls only)
- `POST /api/rewards/daily-checkin/{user_id}` — Daily reward claim
- `GET /api/rewards/status/{user_id}` — Reward status

## Components Added
- `SafetyScoreBadge` — Discover card safety indicator
- `ProfilePromptsEditor` — Edit prompts on Profile page
- `DailyRewardsWidget` — Claim rewards in Settings
- `LadiesFirstToggle` — Toggle in Settings (girls only)

## Pending
- [ ] Server.py Refactoring (10,600+ lines)
- [ ] Google Play VKYC (user side)

## Upcoming
- [ ] Virtual Gifts & HeartCoins spending
- [ ] Girl Referral Bonus (girl→girl extra coins)
- [ ] Prompt Reply in Chat

## Future/Backlog
- [ ] AI Trust Score, Video Intros, Live Location Share
