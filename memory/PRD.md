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
- [x] **SettingsPage.jsx Syntax Error Fix** — Removed misplaced JSX comment inside button tag blocking production build (2026-09-29)

## Pending
- [ ] Server.py Refactoring (11,300+ lines → route modules)
- [ ] Google Play VKYC (user side)

## Upcoming
- [ ] Virtual Gifts & HeartCoins spending
- [ ] AI First Message City Aware

## Future/Backlog
- [ ] AI Trust Score, Video Intros, Live Location Share
