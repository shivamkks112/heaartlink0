# HeartLink - India's Safe Dating App

## Original Problem Statement
Build a modern, safe, trust-based dating app for Indian users with admin panel, Android wrapper (Capacitor), matching logic, push notifications (FCM), and monetization.

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp + capacitor-plugin-safe-area
- Notifications: Firebase Cloud Messaging (FCM)

## Architecture
- `/app/backend/server.py` - Monolithic backend (~7500 lines)
- `/app/backend/fcm_service.py` - Firebase push notification service
- `/app/frontend/src/config/api.js` - Forces production URL for Capacitor
- `/app/frontend/src/utils/safeArea.js` - Multi-layer safe area detection (plugin → env() → screen gap → platform minimums)
- `/app/frontend/android/` - Capacitor Android wrapper

## What's Been Implemented

### Completed (Previous Sessions)
- Android Capacitor Login/CORS fix via CapacitorHttp
- OneSignal → Firebase Cloud Messaging migration (100%)
- Chat UI: Read receipts, Reactions, Avatars, Online Status
- Daily login rewards, Referral system, AI Girl Chatbot

### Completed (July 25-26, 2026)
- **Phase 1 & 2: UI/UX Redesign** — Safe Area + Tinder-style Discover page
- **CRITICAL FIX: Bottom Nav + System Nav Bar Overlap:**
  - Installed `capacitor-plugin-safe-area` for actual Android WindowInsets
  - safeArea.js: 4-layer detection (plugin → CSS env() → screen gap heuristic → platform minimums)
  - On Android Capacitor: min `20*dpr` px (34px floor) safe-bottom
  - Universal 8px minimum floor synced with Navbar CSS max()
  - `--nav-total` now includes border (navInner + safeBottom + 1px)
  - Navbar: Triple-redundant CSS `max(var(--safe-bottom), env(), 8px)` padding
  - All touch targets ≥48px (Material Design compliant)
  - Verified on 5 viewports: Small/Medium/Large/Tablet/Landscape — all ≥24px gap
  - Debounced resize listener to prevent layout thrash

## Pending / Backlog

### P0
- Phases 3-13 UI/UX & QA Audit

### P1
- Admin endpoint authentication (`/api/admin/*` unsecured)
- Refactor server.py into routes/models/services

### P2
- AI-based photo verification, AI Trust Score

## Critical Notes
- **Firebase:** `HEARTLINK_FIREBASE_B64` in K8s. Do NOT change fcm_service.py.
- **Capacitor API:** Always import from `@/config/api.js`.
- **Safe Areas:** Use CSS variables from safeArea.js. On Android: `capacitor-plugin-safe-area` provides actual WindowInsets. User must run `npx cap sync` after pulling code to register the new plugin.
- **Production:** https://dating-app-debug-1.emergent.host (redeploy to push changes)
