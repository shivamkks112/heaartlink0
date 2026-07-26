# HeartLink - India's Safe Dating App

## Original Problem Statement
Build a modern, safe, trust-based dating app for Indian users with admin panel, Android wrapper (Capacitor), matching logic, push notifications (FCM), and monetization.

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
- `/app/frontend/src/utils/safeArea.js` - Dynamic responsive CSS variables for all screen sizes
- `/app/frontend/android/` - Capacitor Android wrapper

## What's Been Implemented

### Completed (Previous Sessions)
- Android Capacitor Login/CORS fix via CapacitorHttp
- OneSignal → Firebase Cloud Messaging migration (100%)
- FCM token race condition fix
- Hardcoded backend URL in config/api.js
- Chat UI: Read receipts, Reactions, Avatars, Online Status
- Heartlink Logo across all Android mipmap densities
- Daily login rewards, Referral system, AI Girl Chatbot

### Completed (July 25-26, 2026)
- **Phase 1: Safe Area Integration** — safeArea.js with 10+ dynamic CSS variables
- **Phase 2: Discover Page Redesign** — Tinder-style full-screen card, dark theme
- **Responsive Layout Fix (ALL screen sizes):**
  - Removed ALL hardcoded heights, margins, bottom paddings
  - safeArea.js now calculates: `--nav-inner`, `--nav-total`, `--card-pad` (min 26dp), `--action-offset`, `--btn-lg/md/sm`, `--vh`
  - `.discover-card-area` uses `calc(100dvh - var(--nav-total) - var(--card-pad))`
  - Action buttons use flexbox flow (NOT absolute bottom-Xpx)
  - Navbar height uses `var(--nav-inner)` instead of hardcoded 52px
  - Button sizes scale proportionally with viewport width
  - **Guaranteed 24-40px gap** between action buttons and bottom navbar on every device
  - Tested: Small (360x780), Medium (393x852), Large (412x915), Tablet (800x1280), Landscape (915x412)
- Fixed LikesYouPage.jsx API import bug
- Fixed DiscoverPage useEffect localStorage ordering bug
- Added onError fallback for broken profile images

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
- **Safe Areas:** Use CSS variables from safeArea.js. NEVER hardcode pixel values for spacing near navbar.
- **Production:** https://dating-app-debug-1.emergent.host (user must redeploy to push preview changes)
