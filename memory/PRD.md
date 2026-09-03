# HeartLink - India's #1 Safe Dating App — PRD

## Overview
Modern, safe, trust-based dating app for Indian users. React frontend + FastAPI backend + MongoDB + Capacitor Android.

## Tech Stack
- Frontend: React 18 + Tailwind + Shadcn/UI + Material 3
- Backend: FastAPI (Python 3.11) + MongoDB (motor async)
- Mobile: Capacitor 7 (Android API 36)
- Push: Firebase Cloud Messaging (FCM)
- AI: emergentintegrations (Gemini/Claude)

## Production Architecture
- Mobile App: https://www.heartlink.co.in
- Web Production: https://dating-app-debug-1.emergent.host (SAME DB)
- Preview: https://trust-based-deploy.preview.emergentagent.com (separate local DB)

## Auth
- Email OTP is the ONLY allowed authentication method
- Phone OTP is permanently removed
- Login field: `email_or_phone` (POST /api/auth/login)

## Key Features (All Implemented)
- Core Dating (Discover, Likes, Matches, Chat, Crush, Boost, Games)
- Chat/Match Filters, Smart Nudge, Show Password
- Admin Dashboard with Growth & Acquisition Analytics
- Install Tracking, Signup Funnel, Acquisition Source Attribution
- Weekly Growth Email Digest (auto Monday 9 AM IST + manual trigger)
- 7-Day Retention Chart
- Smart Welcome Message System (new user + returning user + admin controls)
- WebSocket real-time messaging, Read receipts, Typing indicator
- Firebase push notifications, Daily rewards, Referral system
- All safety features preserved

## Realtime Messaging Architecture (Sep 3, 2026)
### Changes Made
- **Single WebSocket per user**: ChatPage now uses global `wsService` instead of opening its own WS connection. This prevents the backend's ConnectionManager from replacing/killing the global connection.
- **WebSocketService.js**: Handles ALL event types centrally: message, typing_indicator, status_update, screenshot_alert, system_warning, message_deleted, messages_read, message_delivered
- **Ping/heartbeat**: Client pings every 25s → backend updates `last_active` in DB, keeping presence fresh
- **Badge count fix**: Own message echo no longer inflates sender's unread badge count

### Conversations Endpoint
- `GET /api/conversations/{user_id}` — Returns all conversations with lastMessage, unreadCount, user info in ONE call (replaced N+1 pattern)
- MatchesPage uses this endpoint and does inline realtime updates via wsService

### Active Users Fix
- `GET /api/active-users/{user_id}` — Fixed:
  - `privacy_settings.show_profile: {"$ne": False}` (was strict `True`, excluding users without field)
  - Case-insensitive gender matching with `re.escape()`
  - Expanded active threshold from 10min to 30min
  - Removed matched_users exclusion (they can be active too)
  - Active count fetched on mount regardless of which tab is selected

### Presence System
- Online: Set when WS connects or user logs in
- Offline: Set on WS disconnect
- last_active: Updated on login, WS connect, and every 25s via ping
- Reconnect: Exponential backoff up to 30s, max 15 attempts

## Welcome Message System (Sep 1, 2026)
### Backend
- `GET /api/welcome-check/{user_id}` — Returns show/type/title/message/cta
- `POST /api/welcome-shown/{user_id}` — Marks welcome as shown
- `POST /api/welcome-clicked/{user_id}` — Analytics tracking
- `GET /api/admin/welcome-settings` — Admin config + analytics
- `PUT /api/admin/welcome-settings` — Update config remotely

## Pending / Backlog
- P0: Razorpay Premium Subscription (₹99-999/month)
- P1: Virtual Gifts & HeartCoins
- P2: AI-based Photo Verification
- P3: AI Trust Score Algorithm
- P4: Video Intros (15-second profile videos)
- Refactoring: server.py route extraction (8500+ lines → auth.py, matches.py, admin.py, chat.py)
