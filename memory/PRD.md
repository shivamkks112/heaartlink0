# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp
- Notifications: Firebase Cloud Messaging (FCM)

## Completed

### Aug 16, 2026 — Growth & Monetization Features
- **Anonymous Crush**: Users can secretly crush on someone. Target gets "Secret Crush!" notification. Mutual crush = instant reveal + notification to both. Reveal locked behind Premium.
- **Who Viewed Profile**: Full viewer list with blurred names/photos for free users. Premium unlocks full details. Stats: total views + today views.
- **Smart Re-engagement Notifications**: Personalized push to inactive users based on REAL data (view count, crush count, new nearby users). Runs every 6 hours.
- **Crush Button on Discover**: Orange-red gradient button between Pass and Superlike.
- **Crushes + Views Tabs**: Added to LikesYou page with full UI.

### Aug 15-16, 2026 — Growth Features (Free)
- WhatsApp Direct Share on Referral page
- Profile Share Card page (/share-profile)
- SEO City Landing Pages (15 cities: /dating/mumbai, /dating/delhi, etc.)
- City links in Landing page footer
- Share Profile button on Profile page

### Aug 15, 2026 — Admin & Refactoring
- Admin Auth Middleware (temporarily disabled for CapacitorHttp compat)
- server.py Refactoring: database.py, models/schemas.py, services/helpers.py
- JWT_SECRET_KEY stabilized

### Previous (July 2026)
- Complete M3 UI/UX Redesign, Dark Mode, Safe Areas
- Chat fixes, FCM notifications, Gender filtering
- India-only registration, Mandatory Profile Photo

## Pending / Backlog
### P1: Premium Subscription (Razorpay) — monetize Crush reveal + Viewer unlock
### P1: Re-enable admin auth middleware
### P2: Continue server.py route extraction
### P2: AI photo verification

## Key API Endpoints (New)
- POST /api/crush/{user_id}?target_user_id=X — Mark crush
- GET /api/crushes/{user_id} — Get who crushed on you
- GET /api/crushes/{user_id}/sent — Get your sent crushes
- GET /api/profile-viewers/{user_id} — Who viewed profile (blurred for free)
- Smart notifications: auto cron every 6 hours

## Critical Notes
- **Build**: Always `npx craco build`, NOT `npm run build`
- **Admin Auth**: Middleware disabled for Android compat
- **Premium Lock**: Crush reveal + Viewer unlock show "Coming Soon" / "Upgrade" buttons
