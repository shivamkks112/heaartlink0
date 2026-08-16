# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp
- Notifications: Firebase Cloud Messaging (FCM)

## Completed

### Aug 16, 2026 — Engagement & Match Quality Update (Phase 1)
- **Chat Icebreakers**: 6 conversation starters shown when chat is empty. Tap fills composer (user edits before sending). Hides after first messages.
- **Smarter Discovery**: Backend ranks profiles by shared interests, values, lifestyle, verification, online status, profile completeness, trust badge. No fake percentage shown.
- **Profile Completeness Score**: /api/profile/{id}/completeness — 0-100% with weighted checks. Progress bar on Profile page with actionable suggestions.
- **Enhanced Match Cards**: "Shared Interests" badge on Discover cards showing count of common interests.
- **Crush Button on Discover**: Orange-red gradient between Pass and Superlike.

### Aug 16, 2026 — Growth Features
- Anonymous Crush system, Who Viewed Profile (premium paywall), Smart Re-engagement Notifications
- WhatsApp Share, Profile Share Card, SEO City Pages (15 cities)

### Aug 15, 2026 — Admin & Refactoring
- Admin Auth Middleware (temporarily disabled), server.py refactoring, JWT_SECRET_KEY

### Previous — UI/UX & Safety
- Complete M3 redesign, Dark Mode, Chat fixes, Gender notifications, India-only reg, Mandatory Photo

## Pending / Backlog
### P0: Play With Match (Game System) — Phase 2
### P1: Premium Subscription (Razorpay)
### P1: Re-enable admin auth middleware
### P2: Analytics events, Game notifications
### P2: Continue server.py route extraction

## Key API Endpoints
- POST /api/crush/{user_id}?target_user_id=X
- GET /api/crushes/{user_id}
- GET /api/profile-viewers/{user_id}
- GET /api/profile/{user_id}/completeness
- GET /api/discover/{user_id} (now with smart ranking + shared_interests_count)

## Critical Notes
- **Build**: Always `npx craco build`, NOT `npm run build`
- **Admin Auth**: Middleware disabled for Android compat
- **Discover ranking**: Verified + online + shared interests = top. No fake scores exposed.
