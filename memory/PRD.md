# HeartLink - Product Requirements Document

## Original Problem Statement
Modern, safe, trust-based dating app for Indian users. Features include admin panel, Android wrapper (Capacitor), matching, push notifications, strict profile validation, monetization (Ads), and organic growth tools.

## Architecture
- **Frontend**: React (lazy loading, Suspense, WebSocket real-time)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Android**: Capacitor WebView wrapper
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Push**: OneSignal (Primary) + Firebase FCM (Legacy fallback)
- **Email**: Resend (primary) + Microsoft 365 SMTP (fallback)
- **Ads**: Google AdMob (Android native)

## Core Features (All Implemented)
1. Email/Password Auth (Phone OTP removed - Firebase WebView issues)
2. Profile Management with privacy settings + gear icon
3. Matching & Discovery with AI compatibility scoring
4. Real-time Chat (WebSocket) with privacy masking
5. Financial/Money scam detection in chat
6. Women Safety Mode
7. Admin Dashboard (user management, AI profiles, feature toggles)
8. Push Notifications (OneSignal) - like, match, message, daily engagement
9. Referral System + Daily Login Rewards
10. Duplicate Account Prevention
11. Security Hardening (6 headers, CORS, brute force lockout)
12. AI Girl Chatbot (6 profiles, auto-match, Hinglish LLM replies)
13. Google AdMob (Capacitor 7.2.0)
14. SEO (city content, keywords, sitemap)
15. Service Worker (offline caching)

## Production Stabilization (Previous)
16. Real-time WebSocket Hub - Central event system
17. Notification Badge Counts - Real-time via WebSocket
18. Like/Match Instant Sync - WebSocket events
19. Online Status Cleanup - Stale users marked offline after 5 min
20. Profile View Notifications - Real-time via WebSocket
21. LazyImage Component - Intersection Observer
22. Chat Blank Screen Fix
23. Photo Upload Fix - Upload before signup

## Latest Updates (July 2026)
24. Admin Password Reset
25. OneSignal Push Notification Fix
26. Comprehensive Scan - 15/15 tests passed
27. **Capacitor CORS Fix** - CapacitorHttp native plugin enabled, allowNavigation added
28. **Production Notification System Audit & Fix** (July 17, 2026):
    - Fixed critical `send_user_notification` undefined error in signup flows
    - Added OneSignal to chat message push (was FCM-only)
    - Added `android_channel_id` to ALL OneSignal payloads (Android 8+ heads-up)
    - Added OneSignal to verification approve/reject notifications
    - Added dedicated notification functions: superlike, profile_view, welcome, verification, photo_approval, online_status, unread_reminder
    - Added unread message reminder scheduled task
    - Added notification delivery log endpoint for admin
    - Fixed profile approval to send push + in-app notifications
    - Improved frontend: foreground notification display via LocalNotifications
    - Complete deep link handling for ALL notification types
    - Gated Capacitor/OneSignal init behind native platform check (no web errors)
    - 15/15 backend tests + 100% frontend verification passed

## Notification System (Production-Ready)
### Event Coverage:
| Event | WebSocket | In-App | OneSignal Push | FCM (Legacy) |
|-------|-----------|--------|---------------|---------------|
| New Match | Y | Y | Y | Y |
| New Like | Y | Y | Y | Y |
| Super Like | Y | Y | Y | Y |
| Profile View | Y | Y | Y | N |
| New Message | Y | N | Y | Y |
| Online Status | Y | Y | Y | N |
| New User Joined | N | N | Y | N |
| Welcome (Signup) | N | Y | Y | N |
| Verification Approved | N | Y | Y | Y |
| Verification Rejected | N | Y | Y | Y |
| Photo Approved | N | Y | Y | N |
| Photo Rejected | N | Y | Y | N |
| Unread Reminder | N | Y | Y | N |
| Daily Engagement | N | N | Y | Y |
| Inactive Reminder | N | N | Y | Y |
| Admin Broadcast | N | Y | Y | Y |
| Scheduled | N | N | Y | N |

### Android Push Config:
- android_channel_id: `heartlink_notifications` (HIGH importance)
- android_visibility: Public
- android_sound: default
- priority: 10 (highest)

## Key Files
- `/app/backend/server.py` - Main server (7500+ lines)
- `/app/backend/onesignal_config.py` - OneSignal push (production-grade, all events)
- `/app/backend/firebase_config.py` - Firebase FCM (legacy fallback)
- `/app/backend/ai_chatbot.py` - AI chatbot module
- `/app/backend/email_service.py` - Resend + SMTP fallback
- `/app/frontend/src/services/WebSocketService.js` - Central real-time hub
- `/app/frontend/src/services/pushNotifications.js` - FCM + foreground display
- `/app/frontend/src/services/oneSignalService.js` - OneSignal SDK init
- `/app/frontend/src/pages/NotificationsPage.jsx` - Notification list UI
- `/app/frontend/src/components/admin/NotificationManager.jsx` - Admin notification panel
- `/app/frontend/capacitor.config.json` - CapacitorHttp + channels config

## Known Production Issue
- `heartlink.co.in` has Cloudflare 308 redirect to `www.heartlink.co.in` which breaks POST requests. Fix: use `www.heartlink.co.in` as API URL.
- Kubernetes ingress overrides CORS with `*` + `credentials:true` (invalid). Fix: CapacitorHttp bypasses CORS on Android.

## Backlog
- P1: server.py refactor (7500+ lines -> modular routes/models/services)
- P1: Add admin auth/authorization on all /admin/* endpoints (SECURITY)
- P2: AI photo verification
- P3: AI Trust Score
- P3: Weekly activity summary notification
- P3: Premium activated/expiring notifications
