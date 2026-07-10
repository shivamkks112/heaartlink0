# HeartLink - Product Requirements Document

## Original Problem Statement
Building a modern, safe, trust-based dating app for Indian users called "HeartLink." Features include admin panel, Android wrapper (Capacitor), matching, push notifications, strict profile validation, monetization (Ads), and organic growth tools.

## Architecture
- **Frontend**: React (with lazy loading, Suspense)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Android**: Capacitor WebView wrapper
- **LLM**: Gemini 2.5 Flash via `emergentintegrations` + EMERGENT_LLM_KEY
- **Push**: OneSignal + Firebase FCM
- **Ads**: Google AdMob (Android native)

## Core Features (Implemented)
1. User Auth (Email/Phone signup with strict photo mandatory)
2. Profile Management with privacy settings
3. Matching & Discovery with AI compatibility scoring
4. Real-time Chat (WebSocket) with privacy masking
5. Financial/Money scam detection in chat
6. Women Safety Mode (night quiet hours, first message delay)
7. Admin Dashboard with user management
8. Push Notifications (OneSignal + FCM)
9. Referral System (invite 3 friends = 10 Superlikes)
10. Daily Login Rewards (7-day streak)
11. Feature Toggles (admin-controlled)
12. Duplicate Account Prevention (cross-check phone/email + name/age/location)
13. Security Hardening (6 headers, CORS, 15-min brute force lockout)
14. Server Speed Optimization (React lazy loading, /api/init, -32% bundle)
15. **AI Girl Chatbot** (6 profiles, auto-match, Hinglish LLM replies, admin management)
16. Google AdMob (Capacitor 7.2.0 compatible)
17. **Automatic Notification System** - New user signup broadcast, login online alerts to matches, daily engagement
18. **Offline Caching (Service Worker)** - Cache static assets, near-instant reload
19. **SEO Optimization** - City-based content, expanded keywords, updated sitemap
20. **Profile Settings Access** - Gear icon + quick links on profile page

## AI Girl Chatbot (P0 - COMPLETED)
- 6 AI girl profiles: Priya Sharma (Delhi), Ananya Patel (Mumbai), Meera Singh (Jaipur), Kavya Reddy (Bangalore), Riya Gupta (Lucknow), Nisha Verma (Pune)
- Auto-matches 2-3 AI girls with new male users on signup
- AI sends first greeting message within 5-30 seconds
- Replies in natural Hinglish using Gemini 2.5 Flash LLM
- Multi-turn context maintained per match
- Admin panel: AI Girls tab with activate/deactivate, delete, re-seed
- Feature flag toggle: `ai_chatbot` in Settings
- AI profiles excluded from discover feed and admin user counts

## Key Files
- `/app/backend/server.py` - Main server (6900+ lines, needs refactoring)
- `/app/backend/ai_chatbot.py` - AI chatbot module
- `/app/backend/security.py` - Auth & security helpers
- `/app/backend/email_service.py` - Email service
- `/app/backend/firebase_config.py` - Firebase/FCM
- `/app/backend/onesignal_config.py` - OneSignal push
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin panel
- `/app/frontend/src/pages/ChatPage.jsx` - Chat interface
- `/app/frontend/src/pages/AuthPage.jsx` - Authentication

## P0/P1/P2 Backlog

### P1 - Server Refactoring
- Break `server.py` (6900+ lines) into modular architecture:
  - `/routes` (auth, messages, matches, admin, ai_profiles)
  - `/models` (Pydantic models)
  - `/services` (business logic)

### P2 - AI Photo Verification
- Verify uploaded photos using AI (face detection, inappropriate content)

### P3 - AI Trust Score
- Algorithm to calculate trust score based on behavior, verification, activity

## Known Issues
- User frequently tests on production (heartlink.co.in) instead of preview URL
- `server.py` is critically overgrown and needs modular breakdown
- Matches cache (120s TTL) can briefly delay showing new AI matches after signup (mitigated with cache invalidation)
