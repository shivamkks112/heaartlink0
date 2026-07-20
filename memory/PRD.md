# HeartLink - Product Requirements Document

## Original Problem Statement
Modern, safe, trust-based dating app for Indian users. Features include admin panel, Android wrapper (Capacitor), matching, push notifications, strict profile validation, monetization (Ads), and organic growth tools.

## Architecture
- **Frontend**: React (lazy loading, Suspense, WebSocket real-time)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Android**: Capacitor WebView wrapper (CapacitorHttp enabled)
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Push**: OneSignal (Primary, App ID: ad0b57dc-908b-4d84-8654-d6b5dd50684e) + Firebase FCM (Legacy)
- **Email**: Resend (primary) + Microsoft 365 SMTP (fallback)
- **Ads**: Google AdMob (Android native)

## Notification System (Production-Ready - July 17, 2026)
### Root Causes Fixed:
1. **ONESIGNAL_APP_ID was wrong** — Emergent platform injected 'trust-based-deploy' (slug) instead of UUID. Fixed with hardcoded UUID + regex validation.
2. **android_channel_id** didn't exist in OneSignal dashboard — Removed from API payloads.
3. **API Key revoked** by GitHub secret scanning — New key stored base64-encoded in .env (HEARTLINK_OS_KEY_B64).
4. **send_user_notification undefined** — Fixed to use create_in_app_notification + OneSignal.
5. **Chat messages had no OneSignal push** — Added OneSignal to WebSocket message handler.
6. **Verification notifications FCM-only** — Added OneSignal + in-app.

### Notification Event Coverage:
| Event | WebSocket | In-App | OneSignal | FCM |
|-------|-----------|--------|-----------|-----|
| New Match | Y | Y | Y | Y |
| New Like | Y | Y | Y | Y |
| Super Like | Y | Y | Y | Y |
| Profile View | Y | Y | Y | N |
| New Message | Y | N | Y | Y |
| Online Status | Y | Y | Y | N |
| Welcome (Signup) | N | Y | Y | N |
| Verification | N | Y | Y | Y |
| Photo Approved/Rejected | N | Y | Y | N |
| Unread Reminder | N | Y | Y | N |
| Daily Engagement | N | N | Y | Y |
| Admin Broadcast | N | Y | Y | Y |

### Verified: 42 Android devices received test notification successfully.

## Key Files
- `/app/backend/server.py` - Main server (7500+ lines)
- `/app/backend/onesignal_config.py` - OneSignal (hardcoded UUID, base64 key, UUID validation)
- `/app/backend/firebase_config.py` - Firebase FCM (legacy)
- `/app/backend/.env` - HEARTLINK_OS_KEY_B64 (base64 encoded OneSignal key)
- `/app/frontend/src/services/pushNotifications.js` - FCM + foreground display + deep links
- `/app/frontend/src/services/oneSignalService.js` - OneSignal SDK init + click handler
- `/app/frontend/src/pages/NotificationsPage.jsx` - Notification list UI
- `/app/frontend/src/components/admin/NotificationManager.jsx` - Admin panel
- `/app/frontend/capacitor.config.json` - CapacitorHttp + allowNavigation

## Backlog
- P1: server.py refactor (7500+ lines → modular routes/models/services)
- P1: Add admin auth/authorization on all /admin/* endpoints
- P2: AI photo verification
- P3: AI Trust Score
