# HeartLink — Product Requirements Document

## Original Problem Statement
HeartLink is a trust-based dating app for the Indian market focusing on girl retention, safety, monetization, AI chatbot engagement, and real user growth.

## Auth: Email OTP ONLY (Phone OTP permanently banned)

## Tech Stack
React + FastAPI + MongoDB + Capacitor (Android API 36, minSdk 23) + WebSockets + FCM + Google Play Billing + Gemini/Claude AI + AdMob

## Completed Features (Latest First)
- [x] **AI Girl City Matching** — Prioritizes nearby cities, 19 clusters, higher compat for same city (2026-09-27)
- [x] **Regional Language Support** — 11 languages (Tamil, Telugu, Bengali, Punjabi, etc.) auto-detected by city (2026-09-27)
- [x] **Festival Mode Chats** — 18 festivals, auto-injected into AI system prompt based on IST date (2026-09-27)
- [x] **56 Indian Cities** — CITY_VIBES with food, places, vibe, slang for all tier-1 and tier-2 cities (2026-09-27)
- [x] Chat Instant Delivery Fix — WS auto-reconnect, faster zombie detection (2026-09-26)
- [x] Profile Prompts on Onboarding + Safety Score Badge (2026-09-19)
- [x] Ladies First Mode + Girl Daily Rewards + Profile Prompts Hinge-style (2026-09-19)
- [x] 6 Realistic "neutral_real" AI Profiles (2026-09-18)
- [x] Google Play Billing API fixes (2026-09-16)
- [x] Duplicate FCM fixes (2026-09-16)
- [x] All previous features (Premium, AI Verification, Photo Sharing, etc.)

## AI Chatbot Architecture
- 4 personality types: flirty_fun, sweet_caring, witty_smart, neutral_real
- City-aware: fetches user profile, references local food/places/culture
- Regional language mixing: Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi, Gujarati, Odia, Assamese, Kashmiri
- Festival mode: 18 Indian festivals auto-detected by date
- 19 city proximity clusters for smart matching
- 56+ cities with vibes database

## Completed (Recent)
- [x] **Chat Scroll — Bounded Flex Column** — Restructured to `height: 100dvh` flex column: header (`flex-shrink: 0`) + messages (`flex: 1 1 0; min-height: 0; overflow-y: auto`) + input (`flex-shrink: 0`). Only the message list scrolls internally. Auto-scroll uses container's own `scrollTop`. No body scroll, no `scrollIntoView`, no `position: fixed` wrapper. `100dvh` excludes Android system bars. (2026-10-10)
- [x] **Scroll Freeze Multi-Layer Fix** — (1) `activity_main.xml`: `CoordinatorLayout` → `FrameLayout` (stops native scroll interception). (2) CSS: removed `touch-action: pan-y` + `overscroll-behavior-y: contain` from `.overflow-x-auto` class (was blocking Likes page scroll). (3) CSS: removed `user-select: none` from body, added `touch-action: pan-y pan-x`. (4) ChatPage: `overflow: hidden` → `overflow: clip`. (5) Service Worker cache v2→v3, Network-first strategy. (2026-10-10)
- [x] **Likes Page UI Redesign** — Compact gradient header, 2-column grid, filter chips fit-to-screen. (2026-10-10)
- [x] **A-Z Performance Optimization** — Main bundle 872KB→832KB (5% smaller). 20+ pages lazy loaded (was 5 eager + 7 lazy, now 5 eager + all rest lazy). Chat: 100→30 initial messages + scroll-up pagination for older. All images `loading="lazy"`. Like button optimistic UI. Fast `/chat/{id}/info` endpoint (1 call vs 2). ProGuard tightened for Play Store >25% obfuscation. (2026-10-14)
- [x] **App Audit P0** — Scroll fixes (PremiumPage + UserProfilePage bottom padding), Feedback system (5 categories + rate limit + admin view), Analytics events (premium_page_view, purchase_started/success/cancelled, restore_purchases), AdMob frequency cap (5-min cooldown, 3/session max), Double-tap purchase prevention (2026-10-10)
- [x] **Photo Moderation** — Auto-check AI photos via Gemini vision before adding (2026-10-08)
- [x] **AI Photo Batch Generation** — Multi-angle realistic photos for ALL 76 profiles, emergentintegrations v0.2.2 (2026-10-08)
- [x] **AI Identity Hidden** — `is_ai_profile`, `ai_personality`, `vibe` stripped from ALL API responses (2026-10-08)
- [x] **AI Likes 15 min** — Changed from 30 to 15 min delay for new user AI likes (2026-10-08)
- [x] **Rewarded Ads → Super Like** — Server-side: every 3rd rewarded ad grants 1 super like for 30 min, consumed on use (2026-10-08)
- [x] **10 New AI Profiles** — Ananya, Meera, Roshni, Sanya, Tara, Ishita, Naina, Priya, Aisha, Divya — 76 total AI profiles (2026-10-08)
- [x] **AI Likes for New Users** — 15 min delayed staggered AI girl likes to drive premium conversion (2026-10-07)
- [x] **Premium Bypass Protection** — Backend-enforced premium gate on all premium features (2026-10-07)
- [x] **Version Analytics** — Track registrations per app version (Code: 70, Version: 3.3.0) (2026-10-06)
- [x] **AI Photo Generation** — Gemini Nano Banana auto-generates profile photos for daily AI profiles (2026-10-06)
- [x] **Revenue Dashboard** — Daily/weekly bar chart, table, summary cards (Total/Today revenue, approved, conversion), toggle views (2026-10-06)
- [x] **Admin Payment Dashboard Upgrade** — Bulk approve/reject with checkboxes, custom days, reject reason dropdown (2026-10-06)
- [x] **AI Chatbot Upgrade** — Time-aware delays (IST), read receipt before typing, daily 3 new AI profiles auto-created (2026-10-06)
- [x] **Payment Verification Strengthened** — UTR min 6 chars, duplicate UTR block across users, max 3 requests/day rate limit (2026-10-06)
- [x] **UX Overhaul** — Page transitions, pull-to-refresh, premium bottom sheet, haptic feedback, OptimizedImage blur-to-sharp, CSS animations (2026-10-02)
- [x] **Smart Nudge** — In-app banner + 2-hour push notification for non-premium users (2026-10-02)
- [x] **Blurred Like Preview** — Non-premium users see blurred photos + "???" on Likes page (2026-10-02)
- [x] **Trial Only for New Users** — 3-day trial shows only for users < 7 days old, old users see direct ₹49/month (2026-10-02)
- [x] **Like Button Premium Lock** — Non-premium users can't like/superlike, lock icon + toast redirects to premium (2026-10-02)
- [x] **AI Girl Join Notifications** — 30-min scheduler sends "New girl joined!" FCM push to male users with random AI profiles (2026-10-02)
- [x] **Native Feel Cache System** — In-memory + localStorage hybrid cache for all pages (2026-10-02)
- [x] **Profile Premium Instant Display** — Premium badge now shows immediately from localStorage, no flash of "Get Premium" (2026-09-29)
- [x] **UTR/Transaction ID Mandatory** — Made UTR field required in UPI payment flow (frontend + backend validation) (2026-09-29)
- [x] **PremiumPage White Screen Fix** — Added missing `axios` import and `API` from `@/config/api` (2026-09-29)
- [x] **SettingsPage.jsx Syntax Error Fix** — Removed misplaced JSX comment inside button tag blocking production build (2026-09-29)

## Pending
- [ ] Server.py Refactoring (11,300+ lines → route modules)
- [ ] Google Play VKYC (user side)

## Upcoming
- [ ] Virtual Gifts & HeartCoins spending
- [ ] AI First Message City Aware

## Future/Backlog
- [ ] AI Trust Score, Video Intros, Live Location Share

## 2026-06 — Likes/Chat slow-load root cause fix
- Root cause: prod /api/likes returned 13.8MB (30-48s) due to inline base64 photos.
- Added `slim_photos()` + `GET /api/photo/{uid}/{slot}` (serves decoded image, 1yr cache). Applied to likes, crushes, profile-viewers, matches, conversations, chat info.
- Likes: N+1 user lookups batched with $in. Matches: fixed KeyError 'age' 500.
- ChatPage: messages+privacy fetched in parallel with chat info. LikesYouPage: caches likes/crushes/viewers correctly.
- Tested: iteration_39 (backend 9/11 → remaining issue was Cache-Control override, fixed in app; preview ingress still overrides header).

## 2026-06 — Read receipts + first-load blank fix
- Ticks: `_ack_message` (delivered when receiver online/AI; AI marks read after 2-5s), `_deliver_pending` on WS connect, mark-read sets delivered. WS path now acks. ConnectionManager.disconnect only removes the same socket. Index (receiver_id, delivered).
- UI ticks: clock → ✓ → grey ✓✓ → blue ✓✓ (lucide). ackRef handles ack-before-REST race.
- Photos: Mongo `$project` markers (no base64 transfer) for likes/matches/conversations; `/api/photo` thumbnails `?w=` via PIL (840KB→22KB).
- Prefetch fixed: was calling non-existent /api/profiles (404) → now /api/discover; warms image cache. Likes skeleton on first load. DailyReward modal suppressed on /chat.
- Tested: iteration_40 (backend 11/11, frontend 100%).

## 2026-06 — AI persona natural chat
- `_humanize()` in ai_chatbot.py: strips emoji, "!", AI-tell lines; matches user msg length (≤3 words → 1 sentence). Applied to AI + stealth replies & fallbacks. Prompt gets `[reply style: ...]` hint per message.
- First/follow-up/stealth openers simplified to "hii", "hey", "hi kaise ho" etc. Dangling double-messages ("btw", "wait ek aur baat") removed. AI "seen" event fixed to `messages_read`.
- Live LLM check: hi→"hey", "kahan se ho"→"delhi se".

## 2026-06 — AI Reply Timing (admin)
- Admin → AI Girls tab → "AI Reply Timing": toggle Custom/Default + min/max minutes for Night (11pm-7am), Morning (7-10am), Day (10am-7pm), Evening (7-11pm) IST.
- API: GET/PUT /api/admin/ai-reply-timing (require_admin, validation 0.1-180, min<=max). Stored in app_settings type=ai_reply_timing.
- Applied in ai_chatbot.handle_ai_message and handle_stealth_auto_reply via `_admin_reply_delay_minutes`; falls back to built-in timing when disabled.

## 2026-06 — Per-persona timing + online hours
- Admin → AI Girls cards: Reply speed (Default/Quick/Normal/Busy/Custom) + Online hours (IST, Always or start–end) + online dot. API PUT /api/admin/ai-profiles/{id}/schedule (fields reply_delay_min/max, online_hours{start,end}).
- Persona speed overrides global AI Reply Timing. keep_ai_profiles_online respects online_hours (5-min loop); offline personas: no delivered/read ticks, reply deferred.
- resume_pending_ai_replies (runs in 5-min loop): replies to unread user msgs (3min–24h old, last msg from user) for personas online now — survives restarts/schedule changes.
- Fixed pre-existing TypeError: daily AI creator now calls auto_match_new_ai_with_users.
- Tested iteration_41 (backend 20/20, frontend 100%).

## 2026-06 — Rewarded ads: Like reveal + server-side swipes
- Likes page: locked cards have "Watch Ad" (rewarded) → POST /api/likes/{uid}/reveal {liker_id} (max 3/IST day, non-premium only) → /likes returns full data with revealed:true. "Unlock" → /premium. Like on revealed (non-premium) → /premium.
- Swipes server-side: users.swipe_day/swipe_count/extra_swipes; FREE_DAILY_SWIPES=50; /api/action consumes (non-premium like/pass) else 429 out_of_swipes; GET /api/swipes/{uid}. Discover syncs from server, ad reward → POST /api/ads/reward (amount ≤10, max 5/day, $inc atomic, insert-then-count cap).
- Tested iteration_42 + concurrency recheck (10 parallel → exactly 5 granted).

## 2026-06 — Admin "AI Chat Style" tab
- Edit global AI rules template, 4 personality prompts, stealth & custom-persona templates (override stored app_settings type=ai_prompts; empty = default; brace validation; 60s cache cleared on save).
- Per persona: personality, bio, extra context (persona_context appended to system prompt for AI + stealth).
- Live preview: POST /api/admin/ai-prompts/preview (real LLM reply, nothing saved).
- APIs: GET/PUT /api/admin/ai-prompts, GET /api/admin/ai-personas, PUT /api/admin/ai-personas/{id}. Tested iteration_43 (14/14 + UI).

## 2026-06 — Paid Crush/Views + AI profile activity + Hybrid ads
- Free users: /profile-viewers & /crushes return counts only (who = Premium). Legacy /user/{id}/profile-viewers gated. View notifications anonymous for free ("Kisi ne..."). Crush send = Premium (premium check first, target must exist).
- Fixed: views stored as profile_id but read as viewed_user_id (real views never showed). UserProfilePage now records views (6h dedupe).
- ai_profile_activity_loop (30 min, 9AM-11PM IST): female AI/auto-chat accounts visit active male users 1-3x/day; AI Secret Crush ≤1 per 6 days (only if crush_feature flag on). Gender case-insensitive.
- Public GET /api/feature-flags/public (Discover crush button for non-admins).
- Hybrid ads: interstitial every 5 swipes + on chat exit (caps 2 min / 6 per session). Rewarded "Watch Video": reveal Secret Crush (POST /api/crushes/{uid}/reveal, 2/day) and AI chat extend (+10 msgs, 5/day). Free AI chat limit 30 msgs/IST day to AI personas only (429 / WS ai_chat_limit). Caps exposed (reveals_left, videos_left) so Watch Video is hidden when exhausted.
- Toaster added to Chat & Likes pages. Tested iteration_44/45 (backend 28/28).

## 2026-06 — Play Store screenshots + AI on Discover
- /app/store_assets: seed_demo.py (demo account with AI-persona data), compose.py (gradient + device frame + captions, Poppins). Output final/phone (1080x1920 x7), final/tablet (1440x2560 x7), zip HeartLink_PlayStore_Screenshots.zip. Only AI-generated photos used.
- Discover now includes active AI personas; liking an AI persona = instant match (AI auto-like inserted).
- AI profile visits: 1/day per active male user, notifications anonymous ("Someone viewed your profile") for everyone; premium Views tab still lists visitors.

## 2026-06 — Online tab AI + natural AI photos
- /active-users (Online tab) now includes active AI personas that are online (is_online by schedule).
- _generate_ai_photo rewritten: amateur phone-photo variety (selfie/mirror/candid/car/bed/cafe/terrace/commute/function/market, camera quality, expression, consistent look per profile via profile-seeded RNG), no landmarks/text; retries on moderation fail; moderation accepts casual quality. replace=True option.
- Admin AI Girls tab: "Natural Photos" button → POST /api/admin/ai-profiles/regenerate-photos (background, 2 photos/profile, replaces) + status polling.

## 2026-06 — AI Photo Review grid + Story photos
- Admin tab "AI Photos": per persona photo grid (thumb via /api/photo w=300), Redo single photo (background Gemini gen, busy polling), Set main, Delete (not last), Approve; "Sirf pending" filter. APIs: GET /api/admin/ai-photos, POST .../{id}/approve, POST .../{id}/{i}/redo|main, DELETE .../{id}/{i}.
- Story photos: PUT /api/admin/ai-story-photos {enabled, every_days}; ai_story_photo_loop every 3h posts new main photo for max 3 due AI girls (keeps 5 photos). Default OFF.
- Online tab: real users first, online AI personas with photos fill remaining slots. Discover AI requires photo. Daily reward modal suppressed on /admin.
- Tested iteration_46 (all core flows) + fixes verified via curl.
