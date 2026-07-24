# HeartLink - Product Requirements Document

## Architecture
- **Frontend**: React + Capacitor (Android WebView)
- **Backend**: FastAPI (Python) + MongoDB
- **Push**: Firebase Cloud Messaging (FCM) — single provider, no middleman
- **Email**: Resend + Microsoft 365 SMTP fallback
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Ads**: Google AdMob (Capacitor native)

## Notification System (FCM-Only — July 24, 2026)
### Architecture:
- **Backend**: `fcm_service.py` — single source of truth for ALL push notifications
- **Frontend**: `pushNotifications.js` — FCM token management, all notification states, deep linking
- **OneSignal**: REMOVED completely

### Features:
- FCM token stored per user on login
- Auto token refresh via Capacitor PushNotifications
- Android 13+ POST_NOTIFICATIONS runtime permission
- Foreground: Local notification popup via @capacitor/local-notifications
- Background: Firebase handles delivery, tap opens correct screen
- Terminated: Firebase handles delivery, tap opens correct screen
- Notification channel: `heartlink_messages` (HIGH importance, sound, vibration)
- Stale token auto-cleanup (UnregisteredError → token nulled in DB)
- Deep linking: message→chat, match→chat, like→likes, profile_view→profile

### Event Coverage:
| Event | FCM Push | In-App DB |
|-------|----------|-----------|
| New Message | Y | Y |
| New Match | Y | Y |
| New Like | Y | Y |
| Super Like | Y | Y |
| Profile View | Y | Y |
| Welcome | Y | Y |
| Verification | Y | Y |
| Photo Approved/Rejected | Y | Y |
| Online Status | Y (batch) | Y |
| Unread Reminder | Y | Y |
| Admin Broadcast | Y (batch) | Y |
| Daily Engagement | Y | N |

## Key Files
- `/app/backend/fcm_service.py` — FCM notification service (all events)
- `/app/backend/firebase_config.py` — Firebase Admin SDK init (legacy compat)
- `/app/backend/server.py` — Main server
- `/app/frontend/src/services/pushNotifications.js` — FCM client (Android)
- `/app/frontend/src/pages/NotificationsPage.jsx` — In-app notification list
- `/app/frontend/src/components/admin/NotificationManager.jsx` — Admin panel
- `/app/frontend/capacitor.config.json` — CapacitorHttp + Android config

## API Endpoints (Push)
- `POST /api/fcm/register-token` — Register device FCM token
- `POST /api/admin/push/send` — Admin broadcast
- `POST /api/admin/push/test` — Test notification
- `GET /api/admin/push/status` — FCM status
- `POST /api/admin/push/send-to-user/{id}` — Targeted push
- Backward-compat: `/api/admin/onesignal/*` aliases route to FCM

## Backlog
- P1: Admin API authentication (endpoints unprotected)
- P1: server.py refactor (7500+ lines → modular)
- P2: AI photo verification
- P3: AI Trust Score
