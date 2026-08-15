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
- UI Polish Audit (match cards, notifications, profile stats, discover, dark mode)
- Fixed Chat page white/blank screen bugs (removed 100dvh, fixed positioning)
- Fixed duplicate FCM push notifications (removed legacy calls)
- Fixed blurry profile images
- Gender-Based Notification filtering
- India-only registration backend block
- Mandatory Profile Photo upload gate

### Aug 15, 2026
- **Admin API Authentication**: JWT middleware protecting all /api/admin/* endpoints
  - 401 for unauthenticated requests
  - 403 for non-admin users
  - Bootstrap endpoint (make-me-admin-once) excluded from middleware
  - Frontend updated: adminApi.js utility with automatic Bearer token injection
  - All admin dashboard components (AdminDashboard, NotificationManager, ProfileApprovals) use authenticated API calls
- **server.py Refactoring (Phase 1)**:
  - Extracted DB connection into `database.py`
  - Extracted 50+ Pydantic models into `models/schemas.py`
  - Extracted helper functions into `services/helpers.py`
  - server.py reduced from ~7500 to ~6955 lines
- **JWT_SECRET_KEY stabilized**: Now set in .env (no longer random per restart)

## Pending / Backlog
### P1: Continue server.py refactoring (extract routes into routes/*.py modules)
### P2: AI photo verification, AI Trust Score
### P3: Further organic growth features

## Critical Notes
- **Admin Auth**: All /api/admin/* routes require Bearer token with admin user's JWT
- **paddingTop:** All TopBar pages use `calc(var(--safe-top, 24px) + 60px)`
- **Theme:** `--m3-*` CSS variables. Dark via `html.dark` class
- **Safe Areas:** `--nav-total` for bottom padding. NEVER hardcode
- **Production:** https://dating-app-debug-1.emergent.host
- **Capacitor Quirks:** Avoid `100dvh` and `position: fixed` in mobile WebView layouts
- **JWT_SECRET_KEY:** Must be set in backend/.env for token persistence across restarts
