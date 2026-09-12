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
- **Single WebSocket per user**: ChatPage now uses global `wsService` instead of opening its own WS connection
- **WebSocketService.js**: Handles ALL event types centrally
- **Ping/heartbeat**: Client pings every 25s, backend updates `last_active` in DB
- **Badge count fix**: Own message echo no longer inflates sender's unread badge count

## AI Chatbot Girls — 40 Profiles (Sep 5, 2026)
- 40 AI girl profiles with AI-generated Indian face photos across 40 cities
- Personality types: flirty_fun, sweet_caring, witty_smart
- Proactive messaging: AI sends 1st message (1-4hr delay)
- Human-like behavior: varied message lengths, natural typos, filler words

## Safety System (Sep 12, 2026)
### Auto-Unban Timer
- Admin can ban users with duration: 24 hours, 7 days, or permanent
- `ban_expires_at` field stored on user document
- Background `auto_unban_checker()` runs every 30 min (first run on startup)
- Expired temp bans auto-unban user, reset warnings
- Safety Dashboard shows ban duration badge on banned user cards

### Ban Duration Modal
- Clicking "Ban User" anywhere in Safety Dashboard opens a modal
- 3 options: 24 Hours (orange), 7 Days (red), Permanent (black)
- Auto-unban applies to 24h and 7d bans only

## Custom AI Persona - shivamkks545@gmail.com (Sep 12, 2026)
- `CUSTOM_PERSONA_SHIVAM` prompt in ai_chatbot.py
- Ultra-natural girl-like Hinglish chat behavior
- Shy, sweet, moody, subtly flirty personality
- Natural typos, dramatic reactions, casual tone
- Activated when stealth bot email matches shivamkks545@gmail.com

## Serious Relationship Branding (Sep 12, 2026)
- Landing page: "Serious Relationships Only" hero text
- "For Serious Relationships Only" badge
- "No hookups — only meaningful relationships" tagline
- FAQ updated for serious relationship positioning

## Server Architecture
- `/app/backend/server.py` — Main server (~9700 lines)
- `/app/backend/routes/ads.py` — Ad system (184 lines)
- `/app/backend/routes/games.py` — Play With Match (136 lines)
- `/app/backend/routes/boost.py` — Profile boost (79 lines)
- `/app/backend/routes/welcome.py` — Welcome messages (143 lines)
- `/app/backend/ai_chatbot.py` — 40 AI profiles + stealth system + custom persona
- `/app/backend/safety_module.py` — AI content detection, night mode, SOS

## Pending / Backlog
- P0: Razorpay Premium Subscription (Rs 99-999/month)
- P1: Virtual Gifts & HeartCoins
- P1: Server Cleanup Phase 3 (server.py modularization)
- P2: AI-based Photo Verification
- P3: AI Trust Score Algorithm
- P4: Video Intros (15-second profile videos)
- P5: Live Location Share

## Critical Rules
- Email OTP ONLY — no Phone OTP
- No WebP conversion — preserve PNG assets
- No Banner Ads on Discover page
- No APK updates — solve via backend/web changes
- Silent Social Media Block: 30-day block, no warning to receiver
- Respond to user in Hinglish
