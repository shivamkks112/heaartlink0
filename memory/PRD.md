# HeartLink - India's #1 Safe Dating App — PRD

## Overview
Modern, safe, trust-based dating app for Indian users. React frontend + FastAPI backend + MongoDB + Capacitor Android.

## Tech Stack
- **Frontend**: React 18 + Tailwind + Shadcn/UI + Material 3 CSS tokens
- **Backend**: FastAPI (Python 3.11) + MongoDB (motor async)
- **Mobile**: Capacitor 7 (Android API 36) with CapacitorHttp, safe-area plugin, geolocation plugin
- **Push**: Firebase Cloud Messaging (FCM) via `fcm_service.py`
- **AI**: emergentintegrations (Gemini/Claude) for AI chatbot

## Production Architecture
- **Mobile App (Capacitor)**: Connects to `https://www.heartlink.co.in`
- **Web Production**: `https://dating-app-debug-1.emergent.host` (SAME database as heartlink.co.in)
- **Preview**: `https://trust-based-deploy.preview.emergentagent.com` (SEPARATE local DB)
- Both production URLs share the SAME MongoDB — verified via dashboard-stats comparison

## Critical Build Notes
- **ALWAYS use `npx craco build`** — NOT `npm run build` or `react-scripts build`
- **Cap sync**: `npx cap sync android` after every build
- **Admin Auth Middleware**: DISABLED (CapacitorHttp doesn't forward Authorization headers)
- **Avoid**: `100dvh`, `position: fixed` for full-screen Android layouts (use flexbox)
- **Safe areas**: Use `var(--safe-top)`, `var(--nav-total)` CSS variables

## Key Features (All Implemented)
### Core Dating
- Discover, Likes, Matches, Chat (WebSocket real-time)
- Anonymous Crush, Who Viewed Profile, Smart Discovery
- City filter, GPS distance, Profile completeness score
- Chat icebreakers, Read receipts, Typing indicator
- Play With Match games, Profile Boost, Instagram Story share
- Chat Filter (Recent/Oldest/Unread), Match Filter (Recent/Oldest/Best Match/Online)
- Show Password toggle, Smart Nudge (24h no-reply icebreaker)

### Admin Dashboard (FIXED Sep 1, 2026)
- Real-time stats from production DB (IST timezone for "today")
- Auto-refresh every 30 seconds
- No-cache headers on all admin endpoints
- Error banner with retry on failure
- Last-refreshed timestamp on Refresh button
- New signups appear immediately in Recent Signups
- Active Today uses IST midnight boundary

### Safety, Growth, Performance, Notifications
- All previously built features preserved (see CHANGELOG.md)

## Pending / Backlog
- P1: Video Intro (15 sec profile recording)
- P2: Chat media sharing (photos)
- P2: Age filter on Discover
- P3: Razorpay Premium subscription
- P3: server.py route extraction
- P4: AI photo verification, AI Trust Score
