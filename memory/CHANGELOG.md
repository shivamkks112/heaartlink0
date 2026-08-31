# HeartLink — CHANGELOG (What's Already Built)

## ⚠️ FOR NEW AGENT: DO NOT REBUILD THESE FEATURES — THEY ARE ALL DONE AND WORKING

---

## Aug 2026 — All Features Below Are COMPLETE & DEPLOYED

### Discover Page
- [x] Smart ranking (shared interests, city, distance, verification, boost, online status)
- [x] City filter (bottom sheet with popular cities)
- [x] GPS location with Capacitor Geolocation plugin (@capacitor/geolocation)
- [x] Distance display on cards ("3 km away")
- [x] Shared interests badge on cards
- [x] Profile Boost (1 free/day, 30 min priority, +500 ranking)
- [x] Crush button (orange, between Pass and Superlike)
- [x] Swipe counter (top-left)
- [x] Filter icon (top-right, uses var(--safe-top) for Android safe area)
- [x] Offline caching (localStorage, instant load on revisit)

### Chat
- [x] Real-time WebSocket messaging
- [x] Icebreakers (6 conversation starters on empty chat)
- [x] Read receipts: ✓ sent, ✓✓ delivered (grey), ✓✓ read (blue)
- [x] Typing indicator (via WebSocket, 4s auto-hide)
- [x] Play With Match game button (purple gamepad)
- [x] Game invite bubbles (Accept/Decline in chat)
- [x] Phone/email masking, money scam warnings
- [x] Message deletion

### Play With Match (Game System)
- [x] Match Quiz (5 relationship questions)
- [x] Compatibility Challenge (5 lifestyle questions)
- [x] Game session management (create, respond, answer)
- [x] Score calculation + fun compatibility message
- [x] Game overlay UI (menu → playing → waiting → result)
- [x] Push + in-app notifications for invites and results

### Anonymous Crush
- [x] POST /api/crush/{user_id}?target_user_id=X
- [x] GET /api/crushes/{user_id} (who crushed on you)
- [x] Mutual crush detection + notification
- [x] Crush tab on LikesYou page (blurred for non-premium)
- [x] Crush button on Discover cards

### Who Viewed Profile
- [x] GET /api/profile-viewers/{user_id}
- [x] Views tab on LikesYou page
- [x] Blurred names for free users, full for premium
- [x] Total views + today views stats

### Profile
- [x] Completeness score (0-100%) with progress bar + suggestions
- [x] State → City dropdown picker (signup + profile edit)
- [x] Profile Boost button with timer
- [x] Share Profile button (WhatsApp)
- [x] Invite Friends (referral)

### Notifications
- [x] Custom notification sounds (message, match, like) — 3 separate .wav files in res/raw/
- [x] 3 Android notification channels (heartlink_messages, heartlink_matches, heartlink_likes)
- [x] Smart re-engagement (personalized push for inactive users)
- [x] Daily morning picks (5 match suggestions, 9 AM IST)
- [x] Gender-based notification filtering
- [x] Notification tap → direct page navigation (SPA-friendly)

### Growth Features
- [x] Referral system with WhatsApp share
- [x] Profile Share Card page (/share-profile)
- [x] Instagram Story match card (/share-match) with canvas generation
- [x] SEO city landing pages (/dating/mumbai, /dating/delhi, etc. — 15 cities)
- [x] City links in landing page footer

### UI/UX
- [x] Material 3 complete redesign (all screens)
- [x] Dark mode support (Light/Dark/System toggle)
- [x] Safe area handling on ALL pages (var(--safe-top), var(--nav-total))
- [x] Android Capacitor API 36 + CapacitorHttp

### Auth & Safety
- [x] India-only registration (backend block)
- [x] Mandatory profile photo gate (/mandatory-photo)
- [x] JWT auth (tokens stored in localStorage as heartlink_token)
- [x] Admin auth middleware EXISTS but DISABLED (CapacitorHttp doesn't forward Authorization headers)

### Backend Refactoring (Phase 1 — Done)
- [x] database.py (MongoDB connection, caches)
- [x] models/schemas.py (50+ Pydantic models)
- [x] services/helpers.py (shared utility functions)

---

## KNOWN ISSUES (DO NOT IGNORE)
1. Admin auth middleware is DISABLED — admin endpoints are open
2. CapacitorHttp on Android doesn't forward Authorization headers properly
3. Build MUST use `npx craco build` — NOT `npm run build` or `react-scripts build`
4. Avoid `100dvh` and `position: fixed` for Android WebView layouts
5. server.py is still ~7660 lines — needs further route extraction

---

## WHAT IS NOT BUILT YET (BACKLOG)
- Razorpay Premium subscription
- Age filter on Discover
- Chat media sharing (photos)
- Video profile intro
- AI photo verification
- AI Trust Score
- server.py route extraction into routes/*.py
- Re-enable admin auth with Android-compatible approach
