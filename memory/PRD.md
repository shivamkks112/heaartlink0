# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market focusing on girl retention, safety, monetization, AI chatbot engagement, and real user growth.

## Auth: Email OTP ONLY (Phone OTP permanently banned)

## Tech Stack
React + FastAPI + MongoDB + Capacitor (Android API 36, minSdk 23) + WebSockets + FCM + Google Play Billing + Gemini/Claude AI + AdMob

## Completed Features (Latest First)
- [x] **AI Girl City Matching** — Prioritizes nearby cities, 19 clusters, higher compat for same city (2026-09-27)
- [x] **Regional Language Support** — 11 languages (Tamil, Telugu, Bengali, Punjabi, etc.) auto-detected by city (2026-09-27)
- [x] **Festival Mode Chats** — 18 festivals, auto-injected into AI system prompt based on IST date (2026-09-27)
- [x] **56 Indian Cities** — CITY_VIBES with food, places, vibe, slang for all tier-1 and tier-2 cities (2026-09-27)
- [x] Chat Instant Delivery Fix — WS auto-reconnect, faster zombie detection (2026-09-26)
- [x] Profile Prompts on Onboarding + Safety Score Badge (2026-09-19)
- [x] Ladies First Mode + Girl Daily Rewards + Profile Prompts Hinge-style (2026-09-19)
- [x] 6 Realistic "neutral_real" AI Profiles (2026-09-18)
- [x] Google Play Billing API fixes (2026-09-16)
- [x] Duplicate FCM fixes (2026-09-16)
- [x] All previous features (Premium, AI Verification, Photo Sharing, etc.)

## AI Chatbot Architecture
- 4 personality types: flirty_fun, sweet_caring, witty_smart, neutral_real
- City-aware: fetches user profile, references local food/places/culture
- Regional language mixing: Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Gujarati, Odia, Assamese, Kashmiri
- Festival mode: 18 Indian festivals auto-detected by date
- 19 city proximity clusters for smart matching
- 56+ cities with vibes database

## Completed (Recent)
- [x] **Global Scroll Freeze Fix** — Removed `touch-action: manipulation` and `overscroll-behavior: none` from body in index.css, cleaned App.css overscroll rules, removed JS override in App.js. Added `touch-action: pan-y` to `.overflow-y-auto` class and ChatPage messages container for Capacitor WebView scroll support. (2026-10-10)
- [x] **App Audit P0** — Scroll fixes (PremiumPage + UserProfilePage bottom padding), Feedback system (5 categories + rate limit + admin view), Analytics events (premium_page_view, purchase_started/success/cancelled, restore_purchases), AdMob frequency cap (5-min cooldown, 3/session max), Double-tap purchase prevention (2026-10-10)
- [x] **Photo Moderation** — Auto-check AI photos via Gemini vision before adding (2026-10-08)
- [x] **AI Photo Batch Generation** — Multi-angle realistic photos for ALL 76 profiles, emergentintegrations v0.2.2 (2026-10-08)
- [x] **AI Identity Hidden** — `is_ai_profile`, `ai_personality`, `vibe` stripped from ALL API responses (2026-10-08)
- [x] **AI Likes 15 min** — Changed from 30 to 15 min delay for new user AI likes (2026-10-08)
- [x] **Rewarded Ads → Super Like** — Server-side: every 3rd rewarded ad grants 1 super like for 30 min, consumed on use (2026-10-08)
- [x] **10 New AI Profiles** — Ananya, Meera, Roshni, Sanya, Tara, Ishita, Naina, Priya, Aisha, Divya — 76 total AI profiles (2026-10-08)
- [x] **AI Likes for New Users** — 15 min delayed staggered AI girl likes to drive premium conversion (2026-10-07)
- [x] **Premium Bypass Protection** — Backend-enforced premium gate on all premium features (2026-10-07)
- [x] **Version Analytics** — Track registrations per app version (Code: 70, Version: 3.3.0) (2026-10-06)
- [x] **AI Photo Generation** — Gemini Nano Banana auto-generates profile photos for daily AI profiles (2026-10-06)
- [x] **Revenue Dashboard** — Daily/weekly bar chart, table, summary cards (Total/Today revenue, approved, conversion), toggle views (2026-10-06)
- [x] **Admin Payment Dashboard Upgrade** — Bulk approve/reject with checkboxes, custom days, reject reason dropdown (2026-10-06)
- [x] **AI Chatbot Upgrade** — Time-aware delays (IST), read receipt before typing, daily 3 new AI profiles auto-created (2026-10-06)
- [x] **Payment Verification Strengthened** — UTR min 6 chars, duplicate UTR block across users, max 3 requests/day rate limit (2026-10-06)
- [x] **UX Overhaul** — Page transitions, pull-to-refresh, premium bottom sheet, haptic feedback, OptimizedImage blur-to-sharp, CSS animations (2026-10-02)
- [x] **Smart Nudge** — In-app banner + 2-hour push notification for non-premium users (2026-10-02)
- [x] **Blurred Like Preview** — Non-premium users see blurred photos + "???" on Likes page (2026-10-02)
- [x] **Trial Only for New Users** — 3-day trial shows only for users < 7 days old, old users see direct ₹49/month (2026-10-02)
- [x] **Like Button Premium Lock** — Non-premium users can't like/superlike, lock icon + toast redirects to premium (2026-10-02)
- [x] **AI Girl Join Notifications** — 30-min scheduler sends "New girl joined!" FCM push to male users with random AI profiles (2026-10-02)
- [x] **Native Feel Cache System** — In-memory + localStorage hybrid cache for all pages (2026-10-02)
- [x] **Profile Premium Instant Display** — Premium badge now shows immediately from localStorage, no flash of "Get Premium" (2026-09-29)
- [x] **UTR/Transaction ID Mandatory** — Made UTR field required in UPI payment flow (frontend + backend validation) (2026-09-29)
- [x] **PremiumPage White Screen Fix** — Added missing `axios` import and `API` from `@/config/api` (2026-09-29)
- [x] **SettingsPage.jsx Syntax Error Fix** — Removed misplaced JSX comment inside button tag blocking production build (2026-09-29)

## Pending
- [ ] Server.py Refactoring (11,300+ lines → route modules)
- [ ] Google Play VKYC (user side)

## Upcoming
- [ ] Virtual Gifts & HeartCoins spending
- [ ] AI First Message City Aware

## Future/Backlog
- [ ] AI Trust Score, Video Intros, Live Location Share
