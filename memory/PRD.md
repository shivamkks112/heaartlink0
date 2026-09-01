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

## Welcome Message System (Sep 1, 2026)
### Backend
- `GET /api/welcome-check/{user_id}` — Returns show/type/title/message/cta
- `POST /api/welcome-shown/{user_id}` — Marks welcome as shown (stores timestamp)
- `POST /api/welcome-clicked/{user_id}` — Analytics tracking
- `GET /api/admin/welcome-settings` — Admin config + analytics
- `PUT /api/admin/welcome-settings` — Update config remotely
### Database Fields
- `users.welcome_shown_at` — New user welcome timestamp
- `users.welcome_back_shown_at` — Welcome back timestamp
- `users.prev_last_active` — Pre-login last_active (for returning user detection)
- `app_settings {type: "welcome_messages"}` — Admin config
- `app_settings {type: "welcome_analytics"}` — Counters

## Pending / Backlog
- P1: Video Intro, Chat media sharing
- P2: Age filter on Discover, Razorpay Premium
- P3: server.py route extraction, AI photo verification
