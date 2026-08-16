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
├── models/schemas.py   (All Pydantic request/response models)
├── services/helpers.py (Shared utilities)
├── security.py         (JWT, rate limiting, sessions)
├── fcm_service.py      (Firebase push notifications)
├── ai_chatbot.py       (AI girl chatbot)
└── firebase_config.py  (Firebase admin SDK)
```

## Completed

### Aug 15-16, 2026
- **Admin Auth Middleware**: Built but temporarily disabled (CapacitorHttp Android compatibility)
- **server.py Refactoring**: database.py, models/schemas.py, services/helpers.py extracted
- **JWT_SECRET_KEY**: Stabilized in .env
- **Growth Features**:
  - WhatsApp Direct Share on Referral page (green button)
  - Profile Share Card page (/share-profile) with blurred photo card
  - SEO City Landing Pages (/dating/mumbai, /dating/delhi, etc. — 15 cities)
  - City links in Landing page footer for Google indexing
  - Share Profile button on Profile page

### Previous (July 25-26, 2026)
- Complete Material 3 UI/UX Redesign
- Dark Mode, Safe Areas, Chat fixes
- Gender notifications, India-only registration
- Mandatory Profile Photo gate

## Pending / Backlog
### P1: Re-enable admin auth (needs CapacitorHttp fix)
### P1: Premium Subscription (Razorpay) for revenue
### P1: Anonymous Crush + Who Viewed (monetization)  
### P2: Continue server.py route extraction
### P2: AI photo verification

## Critical Notes
- **Build**: Always `npx craco build`, NOT `npm run build`
- **Admin Auth**: Middleware disabled for Android compat
- **SEO Pages**: /dating/:city routes for 15 cities
- **Production**: https://dating-app-debug-1.emergent.host
