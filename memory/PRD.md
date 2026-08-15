# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3 Design System
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp + capacitor-plugin-safe-area
- Notifications: Firebase Cloud Messaging (FCM)

## Architecture (Post-Refactor)
```
/app/backend/
├── server.py           (~6955 lines - main app, middleware, routes)
├── database.py         (MongoDB connection, caches, index creation)
├── models/
│   └── schemas.py      (All Pydantic request/response models)
├── services/
│   └── helpers.py      (Shared utilities: password, user serialization, notifications)
├── routes/             (Prepared for further route extraction)
├── security.py         (JWT, rate limiting, sessions)
├── fcm_service.py      (Firebase push notifications)
├── ai_chatbot.py       (AI girl chatbot)
├── firebase_config.py  (Firebase admin SDK)
└── email_service.py    (Email sending)
```

## Completed
### July 25-26, 2026
- Phase 1 & 2: Safe Area + Tinder-style Discover page
- Bottom Nav + Android System Nav Bar overlap fix
- ALL PAGES safe area fix (A-Z) with dynamic CSS variables
- Complete Material 3 UI/UX Redesign (all screens)
- Dark Mode Support (Light/Dark/System toggle)
- UI Polish Audit
- Fixed Chat page white/blank screen bugs
- Fixed duplicate FCM push notifications
- Fixed blurry profile images
- Gender-Based Notification filtering
- India-only registration backend block
- Mandatory Profile Photo upload gate

### Aug 15, 2026
- **Admin API Auth Middleware**: Built JWT + X-Admin-Id + query param triple-fallback. Temporarily disabled due to CapacitorHttp compatibility issues on Android. Admin endpoints currently open (as before).
- **server.py Refactoring (Phase 1)**:
  - Extracted DB connection into `database.py`
  - Extracted 50+ Pydantic models into `models/schemas.py`
  - Extracted helper functions into `services/helpers.py`
  - server.py reduced from ~7500 to ~6955 lines
- **JWT_SECRET_KEY stabilized**: Now set in .env for token persistence
- **Frontend admin API**: `adminApi.js` utility with auth headers + user ID fallback
- **Frontend build fix**: Production was using stale build; fixed with `craco build`

## Pending / Backlog
### P1: Re-enable admin auth middleware (needs Android CapacitorHttp testing)
### P1: Continue server.py refactoring (extract routes into routes/*.py modules)
### P2: AI photo verification, AI Trust Score
### P3: Further organic growth features

## Critical Notes
- **Admin Auth**: Middleware temporarily disabled. Re-enable after CapacitorHttp header testing
- **Build**: Always use `npx craco build`, NOT `npm run build` or `react-scripts build`
- **paddingTop:** All TopBar pages use `calc(var(--safe-top, 24px) + 60px)`
- **Theme:** `--m3-*` CSS variables. Dark via `html.dark` class
- **Safe Areas:** `--nav-total` for bottom padding. NEVER hardcode
- **Production:** https://dating-app-debug-1.emergent.host
- **Capacitor Quirks:** Avoid `100dvh` and `position: fixed` in mobile WebView layouts
- **JWT_SECRET_KEY:** Must be set in backend/.env for token persistence across restarts
- **CapacitorHttp:** Android app's CapacitorHttp may not forward Authorization headers properly via patched XMLHttpRequest. Direct CapacitorHttp.request() also had issues. Needs deeper investigation.
