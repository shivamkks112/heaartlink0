# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market focusing on girl retention, safety, monetization (Google Play Billing), AI chatbot engagement, and real user growth.

## Auth: Email OTP ONLY (Phone OTP permanently banned)

## Tech Stack
React + FastAPI + MongoDB + Capacitor (Android API 36, minSdk 23) + WebSockets + FCM + Google Play Billing + Gemini/Claude AI + AdMob

## Completed Features (Latest First)
- [x] **Chat Instant Delivery Fix** — WS auto-reconnect on app resume, faster zombie detection, visibility change refresh (2026-09-26)
- [x] Profile Prompts on Onboarding — Conversation starters during signup (2026-09-19)
- [x] Safety Score Badge — Green/Yellow safety indicator on discover cards (2026-09-19)
- [x] Profile Prompts (Hinge-style), Ladies First Mode, Girl Daily Rewards (2026-09-19)
- [x] 6 Realistic "neutral_real" AI Profiles + Enhanced emotional safety (2026-09-18)
- [x] Google Play Billing API fixes (isBillingSupported, offerToken, ProGuard) (2026-09-16)
- [x] Duplicate FCM fixes — Messages + Verification (2026-09-16)
- [x] All previous features (Premium, AI Verification, Photo Sharing, etc.)

## Chat Real-time Architecture
- WebSocket: primary channel for instant messages, typing, status
- HTTP fallback: 3s timeout if WS echo not received
- Auto-reconnect: visibility change + Capacitor resume + 1s base delay
- Zombie detection: 15s pong timeout, 20s ping interval
- Cache: messages cached locally for instant display on chat open

## Pending
- [ ] Server.py Refactoring (10,600+ lines)
- [ ] Google Play VKYC (user side)

## Upcoming
- [ ] Virtual Gifts & HeartCoins spending
- [ ] Girl Referral Bonus

## Future/Backlog
- [ ] AI Trust Score, Video Intros, Live Location Share
