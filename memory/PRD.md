# HeartLink - Product Requirements Document

## Architecture
- **Frontend**: React + Capacitor (Android WebView, CapacitorHttp)
- **Backend**: FastAPI (Python) + MongoDB  
- **Push**: Firebase Cloud Messaging (FCM only)
- **Email**: Resend + SMTP fallback
- **LLM**: Gemini 2.5 Flash via emergentintegrations
- **Ads**: Google AdMob (Capacitor native)
- **API Config**: Centralized `/src/config/api.js` — hardcoded production URL for APK

## Phase 1+2 UI Overhaul (July 25, 2026)

### Discover Screen — Premium Redesign:
- Full-screen card design (h-[62vh] photo area)
- Dark theme (bg-gray-950)
- Skeleton loading with animate-pulse
- Tinder-style NOPE/LIKE swipe overlays
- Photo indicators (horizontal bars at top)
- Photo tap zones (left/right to navigate photos)
- Floating action buttons (Pass/SuperLike/Like)
- Profile info overlay on photo (name, age, location, bio, chips)
- Verified badge on photos
- Swipe counter (top right)

### Chat — Enhanced:
- Profile avatar next to incoming messages (WhatsApp-style)
- Read receipts (Check=sent, CheckCheck=read, blue=read)
- Message reactions via double-tap (heart, laugh, thumbsup, sad, angry)
- Reaction display with emoji badges
- Online status in chat header
- Typing indicator
- Flex layout (no fixed positioning)
- Safe area support

### Profile Page:
- Logout button (red, with LogOut icon)
- Admin Panel link (for admin users, Crown icon)

### Navigation:
- 5 items only: Discover, Likes, Alerts, Chats, Profile
- z-[100] (above all modals)
- Hard pb-5 bottom padding (Android gesture bar safe)
- Compact icons (w-5 h-5, text-[10px] labels)

### Backend:
- POST /api/messages/{message_id}/react — toggle reactions on messages
- MessageReaction model: message_id, user_id, reaction
- WebSocket notification on reaction

## Key Files
- `/app/frontend/src/config/api.js` — Centralized API config (production URL hardcoded)
- `/app/frontend/src/pages/DiscoverPage.jsx` — Premium discover screen
- `/app/frontend/src/pages/ChatPage.jsx` — Chat with reactions + read receipts
- `/app/frontend/src/pages/ProfilePage.jsx` — Profile with logout + admin link
- `/app/frontend/src/components/Navbar.jsx` — 5-item bottom nav
- `/app/backend/fcm_service.py` — FCM notification service
- `/app/backend/server.py` — Main server (7500+ lines)

## Backlog
- P1: Admin API authentication (endpoints unprotected)
- P1: server.py refactor (7500+ lines → modular)
- P2: Image messages (architecture ready, needs UI)
- P2: Voice messages (architecture ready)
- P2: AI photo verification
- P3: Tablet/foldable support
- P3: AI Trust Score
