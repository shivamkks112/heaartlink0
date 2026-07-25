# HeartLink - India's Safe Dating App

## Original Problem Statement
Build a modern, safe, trust-based dating app for Indian users with admin panel, Android wrapper (Capacitor), matching logic, push notifications (FCM), and monetization.

## Core Requirements
1. **Admin Panel & Notifications:** Feature toggles, FCM push notifications
2. **Matching Logic:** Accurate matching, mandatory profile pic, duplicate prevention
3. **Privacy & Safety:** Auto-mask phone/email in chat, scam warnings, blocked social handles
4. **Organic Growth:** Referral system, daily login rewards, AI Girl Chatbot, SEO
5. **Security:** Rate limiting, brute-force lockouts, lazy loading
6. **Premium UI/UX:** Tinder/Bumble level, responsive, Android Safe Areas

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor (Android) with CapacitorHttp
- Notifications: Firebase Cloud Messaging (FCM)
- LLMs: Emergent integrations (Gemini/Claude)

## Architecture
- `/app/backend/server.py` - Monolithic backend (~7500 lines, needs refactoring)
- `/app/backend/fcm_service.py` - Firebase push notification service
- `/app/frontend/src/config/api.js` - Forces production URL for Capacitor
- `/app/frontend/src/utils/safeArea.js` - Android WindowInsets CSS variables
- `/app/frontend/android/` - Capacitor Android wrapper

## What's Been Implemented

### Completed (Previous Sessions)
- Android Capacitor Login/CORS fix via CapacitorHttp
- OneSignal to Firebase Cloud Messaging migration (100%)
- FCM token generation race condition fix
- Hardcoded backend URL in config/api.js
- Chat UI: Read receipts, Reactions, Avatars, Online Status
- Heartlink Logo across all Android mipmap densities
- Daily login rewards system
- Referral system
- AI Girl Chatbot profiles

### Completed (Current Session - July 25, 2026)
- **Phase 1: Safe Area Integration** - Created safeArea.js with CSS variables (--safe-bottom, --safe-top, --nav-height, --header-offset). Updated Navbar.jsx and App.css to use variables. Added mobile web fallback.
- **Phase 2: Discover Page Redesign** - Full Tinder-style card layout. Card fills 95%+ screen height. Profile photo fills entire card. Gradient overlays. Photo indicators + tap zones. Swipe labels (NOPE/LIKE). Action buttons (Pass/SuperLike/Like) with clear spacing from navbar. Emerald green Like button. Dark theme (#0a0a0a).
- Fixed LikesYouPage.jsx API import bug (was placed inside CSS block)
- Fixed DiscoverPage useEffect localStorage initialization ordering bug
- Updated global CSS classes to use safe area CSS variables

## Pending / Backlog

### P0
- Phases 3-13 UI/UX & QA Audit (Chat UI polish, Notifications re-test, Performance, Firebase Security Rules, Discover Algorithm)

### P1
- Admin endpoint authentication (`/api/admin/*` currently unsecured)
- Refactor server.py into routes/models/services

### P2
- AI-based photo verification
- AI Trust Score algorithm

## Critical Notes
- **Firebase K8s Override:** `HEARTLINK_FIREBASE_B64` stores service account JSON. Do NOT change fcm_service.py decode logic.
- **Capacitor API Config:** Always import `API_URL` from `@/config/api.js`, not `process.env` directly.
- **Safe Areas:** Use CSS variables from safeArea.js (--safe-bottom, --nav-height, etc.), not hardcoded padding.
