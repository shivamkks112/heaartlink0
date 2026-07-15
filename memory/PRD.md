# HeartLink - Product Requirements Document

## Original Problem Statement
Modern, safe, trust-based dating app for Indian users. Features include admin panel, Android wrapper (Capacitor), matching, push notifications, strict profile validation, monetization (Ads), and organic growth tools.

## Architecture
- **Frontend**: React (lazy loading, Suspense, WebSocket real-time)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Android**: Capacitor WebView wrapper
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Push**: OneSignal (App ID: ad0b57dc-908b-4d84-8654-d6b5dd50684e)
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

## Production Stabilization (Latest)
16. **Real-time WebSocket Hub** - Central event system for all real-time features
17. **Notification Badge Counts** - Real-time via WebSocket (no polling)
18. **Like/Match Instant Sync** - WebSocket events for new_like, new_match
19. **Online Status Cleanup** - Stale users marked offline after 5 min
20. **Profile View Notifications** - Real-time via WebSocket
21. **LazyImage Component** - Intersection Observer based lazy loading
22. **Chat Blank Screen Fix** - Proper error handling in fetchMatch
23. **Photo Upload Fix** - Upload before signup (not after)

## Key Files
- `/app/backend/server.py` - Main server (7100+ lines)
- `/app/backend/ai_chatbot.py` - AI chatbot module
- `/app/backend/email_service.py` - Resend + SMTP fallback
- `/app/backend/onesignal_config.py` - OneSignal push
- `/app/frontend/src/services/WebSocketService.js` - Central real-time hub
- `/app/frontend/src/components/Navbar.jsx` - Real-time badge counts
- `/app/frontend/src/components/LazyImage.jsx` - Image lazy loading

## Latest Updates (July 2026)
24. **Admin Password Reset** - Admin can reset any user's password from the dashboard (KeyRound button on user cards, modal with password input)

## Backlog
- P1: server.py refactor (7200+ lines → modular routes/models/services)
- P1: Add admin auth/authorization on all /admin/* endpoints (SECURITY)
- P2: AI photo verification
- P3: AI Trust Score
