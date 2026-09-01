# HeartLink - India's #1 Safe Dating App — PRD

## Overview
Modern, safe, trust-based dating app for Indian users. React frontend + FastAPI backend + MongoDB + Capacitor Android.

## Tech Stack
- **Frontend**: React 18 + Tailwind + Shadcn/UI + Material 3 CSS tokens
- **Backend**: FastAPI (Python 3.11) + MongoDB (motor async)
- **Mobile**: Capacitor 7 (Android API 36)
- **Push**: Firebase Cloud Messaging (FCM)
- **AI**: emergentintegrations (Gemini/Claude)

## Production Architecture
- **Mobile App**: Connects to `https://www.heartlink.co.in`
- **Web Production**: `https://dating-app-debug-1.emergent.host` (SAME DB)
- Both share the SAME MongoDB

## Key Features (All Implemented)
- Core Dating (Discover, Likes, Matches, Chat, Crush, Boost, Games)
- Chat/Match Filters, Smart Nudge, Show Password
- Admin Dashboard with Growth & Acquisition Analytics
- Install Tracking, Signup Funnel, Acquisition Source Attribution
- WebSocket real-time messaging, Read receipts, Typing indicator
- Firebase push notifications, Daily rewards, Referral system
- All safety features preserved

## Analytics System (NEW - Sep 1, 2026)
### Backend Endpoints
- `POST /api/analytics/track-install` — First open tracking (idempotent)
- `POST /api/analytics/track-event` — Funnel event tracking
- `GET /api/admin/growth-stats?period=today|yesterday|week|month` — Growth metrics
- `GET /api/admin/acquisition-table?page=1&limit=20` — Acquisition records

### Database
- `installs` collection with indexes on installation_id, first_open_at, signup_status, acquisition_source
- Links to users collection via user_id field

### Frontend
- `src/utils/installTracker.js` — Privacy-safe install ID generation, UTM/referrer attribution
- `src/components/admin/GrowthAcquisition.jsx` — Full admin analytics tab
- Integrated in App.js (track on mount) and AuthPage.jsx (track signup events)

## Pending / Backlog
- P1: Video Intro, Chat media sharing
- P2: Age filter on Discover
- P3: Razorpay Premium, server.py route extraction
- P4: AI photo verification, AI Trust Score
