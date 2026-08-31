# HeartLink - India's #1 Safe Dating App — PRD

## Overview
Modern, safe, trust-based dating app for Indian users. React frontend + FastAPI backend + MongoDB + Capacitor Android.

## Tech Stack
- **Frontend**: React 18 + Tailwind + Shadcn/UI + Material 3 CSS tokens
- **Backend**: FastAPI (Python 3.11) + MongoDB (motor async)
- **Mobile**: Capacitor 7 (Android API 36) with CapacitorHttp, safe-area plugin, geolocation plugin
- **Push**: Firebase Cloud Messaging (FCM) via `fcm_service.py`
- **AI**: emergentintegrations (Gemini/Claude) for AI chatbot

## Architecture
```
/app/backend/
├── server.py           (~7669 lines - main app, ALL routes, middleware)
├── database.py         (MongoDB connection, caches, index creation)
├── models/schemas.py   (All Pydantic request/response models)
├── services/helpers.py (Shared utilities: password, serialization, notifications)
├── security.py         (JWT tokens, rate limiting, brute force)
├── fcm_service.py      (Firebase push notifications + engagement templates)
├── ai_chatbot.py       (AI girl chatbot)
├── firebase_config.py  (Firebase Admin SDK init)
├── email_service.py    (Email sending)
└── .env                (MONGO_URL, DB_NAME, JWT_SECRET_KEY, FIREBASE keys)

/app/frontend/
├── src/App.js          (Routing, auth guard, lazy loading, prefetch)
├── src/pages/          (All page components)
├── src/components/     (Reusable components incl PlayWithMatch game)
├── src/utils/          (adminApi.js, cacheManager.js)
├── src/config/api.js   (API URL config - PRODUCTION_URL for Capacitor)
├── src/data/indianCities.js (States + cities data)
├── src/styles/material3.css (M3 design tokens)
├── android/            (Capacitor Android project)
└── .env                (REACT_APP_BACKEND_URL)
```

## Critical Build Notes
- **ALWAYS use `npx craco build`** — NOT `npm run build` or `react-scripts build`
- **Cap sync**: `npx cap sync android` after every build
- **Admin Auth Middleware**: DISABLED in server.py (CapacitorHttp doesn't forward Authorization headers)
- **Avoid**: `100dvh`, `position: fixed` for full-screen Android layouts (use flexbox)
- **Safe areas**: Use `var(--safe-top)`, `var(--nav-total)` CSS variables

## Key Features (All Implemented)
### Core Dating
- Discover (smart ranked), Likes, Matches, Chat (WebSocket real-time)
- Anonymous Crush system, Who Viewed Profile (premium paywall)
- Smart Discovery: ranked by shared interests, city, distance, verification, boost, online status
- City filter (bottom sheet), GPS distance on cards
- Profile completeness score (0-100%)
- Chat icebreakers (6 conversation starters)
- Read receipts: single/double/blue ticks
- Typing indicator (via WebSocket, 4s auto-hide)
- Play With Match (Match Quiz + Compatibility Challenge in chat)
- Profile Boost (1 free/day, 30 min top priority)
- Instagram Story match share card
- Chat Filter (Recent / Oldest / Unread) on Messages tab
- Show Password toggle on Login + Signup forms

### Safety & Admin
- India-only registration, mandatory profile photo
- Phone/email masking in chat, money scam warnings
- Gender-based notification filtering
- Admin dashboard (temporarily without auth)
- Profile verification, ban/shadow-ban system

### Growth
- Referral system with WhatsApp share
- Smart re-engagement notifications (personalized, data-based)
- Daily morning picks (5 match suggestions push)
- SEO city landing pages (/dating/mumbai, /dating/delhi, etc.)
- Profile share card, match share card
- Custom notification sounds (message, match, like)

### Performance
- Offline caching (Discover profiles, chat messages)
- Chat prefetch (top 3 conversations on login)
- Image lazy loading + async decoding
- Matches cache with write-through invalidation on new match

## API Endpoints (Key)
- POST /api/auth/signup, /api/auth/login
- GET /api/discover/{user_id}?city=X&limit=N
- POST /api/action/{user_id} (like/pass/superlike)
- POST /api/crush/{user_id}?target_user_id=X
- GET /api/crushes/{user_id}
- GET /api/profile-viewers/{user_id}
- GET /api/profile/{user_id}/completeness
- POST /api/boost/{user_id}
- POST /api/game/create?match_id=X&game_type=X&sender_id=X
- POST /api/game/{id}/respond, /api/game/{id}/answer
- GET /api/messages/{match_id}
- POST /api/messages/{match_id}/mark-read/{user_id}
- All /api/admin/* (no auth currently)

## Pending / Backlog
- P1: Video Intro (15 sec profile recording)
- P2: Chat media sharing (photos)
- P2: Age filter on Discover
- P3: Razorpay Premium subscription (monetize crush/viewer/boost)
- P3: Re-enable admin auth (fix CapacitorHttp header forwarding)
- P3: server.py route extraction (routes/*.py modules)
- P4: AI photo verification, AI Trust Score

## Production
- Web: https://dating-app-debug-1.emergent.host
- Android: Capacitor APK (Play Store)
- Backend API: Same domain /api/*
