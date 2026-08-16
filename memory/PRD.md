# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android)
- Notifications: Firebase Cloud Messaging (FCM)

## Completed

### Aug 16, 2026 — Phase 2: Play With Match + Boost + Share
- **Play With Match Game System**:
  - "Play Together" button (purple gamepad) in Chat input area
  - Match Quiz (5 fun relationship questions) + Compatibility Challenge (5 lifestyle questions)
  - Game invite sent as special chat message with Accept/Decline buttons
  - Score calculation on both answers submitted, fun compatibility % with message
  - Game overlay UI: menu → playing (with progress bar) → waiting → result
  - Push + in-app notifications for invites and results
  - Backend: /api/game/create, /api/game/{id}/respond, /api/game/{id}/answer, /api/game/{id}
  
- **Profile Boost**:
  - 1 free boost per day, 30 minute duration
  - Boosted profiles get +500 ranking score in Discover (appear first)
  - Boost button on Profile page with status indicator
  - Backend: /api/boost/{user_id}, /api/boost/{user_id}/status

- **Instagram Story Match Card**:
  - Canvas-generated 1080x1920 story card with gradient background
  - "We Matched!" + names + HeartLink branding + CTA
  - Share to Instagram Stories, WhatsApp, or Download
  - Share button on each Match card in Matches page
  - Route: /share-match

### Aug 16, 2026 — Phase 1: Engagement & Match Quality
- Chat Icebreakers, Smarter Discovery, Profile Completeness, Enhanced Match Cards

### Aug 16, 2026 — Growth Features
- Anonymous Crush, Who Viewed Profile, Smart Re-engagement Notifications
- WhatsApp Share, Profile Share Card, SEO City Pages

### Aug 15, 2026 — Admin & Refactoring
- Admin Auth Middleware (temporarily disabled), server.py refactoring, JWT_SECRET_KEY

## Pending / Backlog
### P1: Razorpay Premium Subscription (monetize crush reveal, viewer unlock, extra boosts)
### P1: Re-enable admin auth (needs CapacitorHttp fix)
### P2: Analytics events
### P2: AI photo verification

## Key API Endpoints
- POST /api/game/create?match_id=X&game_type=match_quiz&sender_id=X
- POST /api/game/{id}/respond?user_id=X&action=accept
- POST /api/game/{id}/answer?user_id=X (body: {q1: "opt", q2: "opt"...})
- GET /api/game/{id}
- POST /api/boost/{user_id}
- GET /api/boost/{user_id}/status
- GET /api/profile/{id}/completeness

## Build
- Always `npx craco build`, NOT `npm run build`
- `npx cap sync android` after build for APK
