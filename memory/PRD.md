# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp + capacitor-plugin-safe-area
- Notifications: Firebase Cloud Messaging (FCM)

## Architecture
- `/app/backend/server.py` - Monolithic backend (~7500 lines)
- `/app/backend/fcm_service.py` - Firebase push notification service
- `/app/frontend/src/config/api.js` - Forces production URL for Capacitor
- `/app/frontend/src/utils/safeArea.js` - Multi-layer safe area detection
- `/app/frontend/android/` - Capacitor Android wrapper

## Completed (July 25-26, 2026)
- Phase 1 & 2: UI/UX Redesign — Safe Area + Tinder-style Discover page
- CRITICAL FIX: Bottom Nav + System Nav Bar Overlap (4-layer detection)
- **ALL PAGES safe area fix (A-Z):** Removed ALL hardcoded `pb-XX` from every navbar page. Replaced with `calc(var(--nav-total, 86px) + 16px)`. Pages fixed: MatchesPage, ProfilePage, LikesYouPage, NotificationsPage, PrivacyPage, ProfileEnhancementPage, ProfileViewersPage, ReferralPage, SettingsPage, UserProfilePage, AdminDashboard, ChatPage (input area), DiscoverPage.
- Testing agent verified: 100% pass, all 5 tabs, gap ≥24px, touch targets ≥48px, no content hidden behind navbar.

## Pending / Backlog
### P0: Phases 3-13 UI/UX & QA Audit
### P1: Admin API authentication, server.py refactoring
### P2: AI photo verification, AI Trust Score

## Critical Notes
- **Firebase:** `HEARTLINK_FIREBASE_B64` in K8s. Do NOT change fcm_service.py.
- **Capacitor API:** Always import from `@/config/api.js`.
- **Safe Areas:** NEVER use hardcoded `pb-XX` for navbar clearance. Use `calc(var(--nav-total, 86px) + 16px)` or `page-with-bottom-nav` class.
- **Production:** https://dating-app-debug-1.emergent.host (redeploy to push changes)
