# HeartLink — CHANGELOG (What's Already Built)

## FOR NEW AGENT: DO NOT REBUILD THESE FEATURES — THEY ARE ALL DONE AND WORKING

---

## Sep 3, 2026 — Realtime Messaging + Active Users Fix + Crush Admin + Button Redesign + AI Girls Upgrade
- [x] **CRITICAL FIX**: ChatPage no longer creates duplicate WebSocket (uses global wsService)
- [x] **CRITICAL FIX**: Active Users "Active(0)" bug — fixed privacy_settings filter, case-insensitive gender matching, expanded threshold
- [x] New `/api/conversations/{user_id}` endpoint — returns all conversations with lastMessage & unreadCount in single call
- [x] MatchesPage inline realtime updates — new messages update conversation preview without full refetch
- [x] Active tab count loads on mount regardless of which tab is selected
- [x] WebSocket ping (25s) updates `last_active` in DB for reliable presence
- [x] Badge count fix — sender's own message echo no longer inflates unread count
- [x] Regex escape for gender values in active-users query (security hardening)
- [x] WebSocketService handles all event types: typing_indicator, screenshot_alert, message_deleted, messages_read, message_delivered
- [x] **Crush Feature**: Paused by default, admin toggle via feature_flags (crush_feature), backend returns 403 when OFF, frontend hides button
- [x] **Like/Pass Buttons Redesign**: Glassmorphic floating dock, Pass(rose X)/SuperLike(blue star)/Like(green heart with pulse)/Crush(amber flame, conditional)
- [x] **Track Install Fix**: Atomic upsert replaces find_one+insert_one (fixes DuplicateKeyError 500)
- [x] **Feature Flags Merge**: GET /api/admin/feature-flags now always merges stored values with defaults
- [x] **Tab Strip Fix**: Mobile-responsive tab labels (shortened on <640px)
- [x] **AI Girls Upgrade**: 15 total AI profiles (5 new + 10 existing), all with AI-generated realistic Indian face photos
- [x] **New AI Girls**: Ishita Sen (Kolkata), Diya Joshi (Indore), Kiara Rathore (Udaipur), Naina Thapa (Shillong), Sara Mehta (Ahmedabad)
- [x] **Proactive Messaging**: AI girls send 1st message (1-4hr delay) + optional follow-up (2-6hr if no reply, 50% chance)
- [x] **Human-like Personality**: Varied message lengths, natural filler words, emotional intelligence, no robotic patterns
- [x] **Enhanced System Prompt**: Pure human feel — typos, broken sentences, double messages, voice note vibe
- [x] **AdMob Impression Audit**: Root cause found — TWO competing ad services, premature `interstitialReady`, no event listeners
- [x] **AdsService.js Rewritten**: Proper state machine (IDLE→LOADING→LOADED→SHOWING→DISMISSED), event-driven via InterstitialAdPluginEvents/RewardAdPluginEvents
- [x] **adMobService.js**: Converted to thin wrapper over AdsService (eliminates duplicate init/requests)
- [x] **No duplicate requests**: State guards prevent prepare while LOADING/LOADED
- [x] **Show waits for load**: If interstitial is LOADING when show triggers, waits up to 8s instead of returning false
- [x] **Debug diagnostics**: `adsService.getDebugLog()` available for dev troubleshooting
- [x] **Banner Ads on Discover**: ADAPTIVE_BANNER at BOTTOM_CENTER, shows on mount, hides on navigate away, event-driven state tracking
- [x] **Ad Analytics Dashboard**: New admin tab with impression stats, daily chart, type breakdown, rewards tracking, top users, estimated revenue
- [x] **Ad Revenue in Weekly Email**: Ad impressions, est. revenue, type breakdown, users reached — all added to Monday weekly digest
- [x] **Server Cleanup Phase 1**: Extracted 4 route modules (ads, games, boost, welcome) — 543 lines moved out, server.py 8839→8179

---


## Aug 31, 2026 — Latest Session
- [x] Show Password toggle (Eye/EyeOff) on Login + Signup forms (AuthPage.jsx)
- [x] Chat Filter strip (Recent / Oldest / Unread) on Messages tab (MatchesPage.jsx)
- [x] Match Filter strip (Recent / Oldest / Best Match / Online) on Matches tab (MatchesPage.jsx)
- [x] Notification badge WebSocket fix — mark-read always sends badge_update, self-heals stale counts
- [x] Badge suppression — badges show 0 when user is viewing that section (pathRef approach)
- [x] Fixed prefetchRecentChats 404 — was calling non-existent /conversations endpoint
- [x] Fixed matches_cache invalidation on new match creation
- [x] Fixed Navbar Alerts badge double-counting
- [x] Smart Nudge — gentle icebreaker prompt in ChatPage when match hasn't replied 24h+
- [x] Nudge indicator pill on MatchesPage conversation cards
- [x] Nudge dismiss persisted per match in localStorage (48h cooldown)
- [x] Deterministic icebreaker selection (hash of matchId, not random)

---

## Aug 2026 — All Features Below Are COMPLETE & DEPLOYED

### Discover Page
- [x] Smart ranking (shared interests, city, distance, verification, boost, online status)
- [x] City filter (bottom sheet with popular cities)
- [x] GPS location with Capacitor Geolocation plugin (@capacitor/geolocation)
- [x] Distance display on cards ("3 km away")
- [x] Shared interests badge on cards
- [x] Profile Boost (1 free/day, 30 min priority, +500 ranking)
- [x] Crush button (orange, between Pass and Superlike)
- [x] Swipe counter (top-left)
- [x] Filter icon (top-right, uses var(--safe-top) for Android safe area)
- [x] Offline caching (localStorage, instant load on revisit)

### Chat
- [x] Real-time WebSocket messaging
- [x] Icebreakers (6 conversation starters on empty chat)
- [x] Read receipts: single/double/blue ticks
- [x] Typing indicator (via WebSocket, 4s auto-hide)
- [x] Play With Match game button (purple gamepad)
- [x] Game invite bubbles (Accept/Decline in chat)
- [x] Phone/email masking, money scam warnings
- [x] Message deletion
- [x] Chat Filter (Recent / Oldest / Unread) on Messages tab
- [x] Smart Nudge (24h no-reply icebreaker prompt)

### Play With Match (Game System)
- [x] Match Quiz (5 relationship questions)
- [x] Compatibility Challenge (5 lifestyle questions)
- [x] Game session management (create, respond, answer)
- [x] Score calculation + fun compatibility message
- [x] Game overlay UI (menu -> playing -> waiting -> result)
- [x] Push + in-app notifications for invites and results

### Anonymous Crush
- [x] POST /api/crush/{user_id}?target_user_id=X
- [x] GET /api/crushes/{user_id} (who crushed on you)
- [x] Mutual crush detection + notification
- [x] Crush tab on LikesYou page (blurred for non-premium)
- [x] Crush button on Discover cards

### Who Viewed Profile
- [x] GET /api/profile-viewers/{user_id}
- [x] Views tab on LikesYou page
- [x] Blurred names for free users, full for premium
- [x] Total views + today views stats

### Profile
- [x] Completeness score (0-100%) with progress bar + suggestions
- [x] State -> City dropdown picker (signup + profile edit)
- [x] Profile Boost button with timer
- [x] Share Profile button (WhatsApp)
- [x] Invite Friends (referral)

### Notifications
- [x] Custom notification sounds (message, match, like) — 3 separate .wav files in res/raw/
- [x] 3 Android notification channels (heartlink_messages, heartlink_matches, heartlink_likes)
- [x] Smart re-engagement (personalized push for inactive users)
- [x] Daily morning picks (5 match suggestions, 9 AM IST)
- [x] Gender-based notification filtering
- [x] Notification tap -> direct page navigation (SPA-friendly)
- [x] Badge counts via WebSocket (self-healing on mark-read)

### Growth Features
- [x] Referral system with WhatsApp share
- [x] Profile Share Card page (/share-profile)
- [x] Instagram Story match card (/share-match) with canvas generation
- [x] SEO city landing pages (/dating/mumbai, /dating/delhi, etc. — 15 cities)
- [x] City links in landing page footer

### UI/UX
- [x] Material 3 complete redesign (all screens)
- [x] Dark mode support (Light/Dark/System toggle)
- [x] Safe area handling on ALL pages (var(--safe-top), var(--nav-total))
- [x] Android Capacitor API 36 + CapacitorHttp
- [x] Show Password toggle on auth forms
- [x] Filter strips on Matches + Messages tabs

### Auth & Safety
- [x] India-only registration (backend block)
- [x] Mandatory profile photo gate (/mandatory-photo)
- [x] JWT auth (tokens stored in localStorage as heartlink_token)
- [x] Admin auth middleware EXISTS but DISABLED (CapacitorHttp doesn't forward Authorization headers)

### Backend Refactoring (Phase 1 — Done)
- [x] database.py (MongoDB connection, caches)
- [x] models/schemas.py (50+ Pydantic models)
- [x] services/helpers.py (shared utility functions)

---

## KNOWN ISSUES (DO NOT IGNORE)
1. Admin auth middleware is DISABLED — admin endpoints are open
2. CapacitorHttp on Android doesn't forward Authorization headers properly
3. Build MUST use `npx craco build` — NOT `npm run build` or `react-scripts build`
4. Avoid `100dvh` and `position: fixed` for Android WebView layouts
5. server.py is still ~7670 lines — needs further route extraction

---

## WHAT IS NOT BUILT YET (BACKLOG)
- Video Intro (15 sec profile recording)
- Chat media sharing (photos)
- Age filter on Discover
- Razorpay Premium subscription
- AI photo verification
- AI Trust Score
- server.py route extraction into routes/*.py
- Re-enable admin auth with Android-compatible approach
