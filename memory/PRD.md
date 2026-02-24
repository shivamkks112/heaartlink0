# HeartLink - Premium Safety Dating App PRD

## Original Problem Statement
Build a modern, safe, trust-based dating app for Android called "HeartLink" for Indian users. The app focuses on creating a premium, respectful, safe dating experience with emphasis on genuine users and female safety.

## Latest Update (February 2025)

### Online Status Color Differentiation & Safety Popup ✅ (Feb 24, 2025)

**Features Implemented:**

1. **Online Status Color Differentiation** 
   - 🟢 **Dark Green (bg-green-600)** = Online Now (within 5 minutes) with pulse animation
   - 🟡 **Yellow (bg-yellow-500)** = Recently Active (5 minutes to 24 hours)
   - ⚪ **Gray (bg-gray-400)** = Offline (more than 24 hours or no data)
   - Applied across all pages: Matches tab, Messages tab, Active tab, Chat header

2. **Safety Message Popup**
   - Modal appears when user clicks "Chat" button for first time
   - Shows 3 safety tips:
     - Never share personal info (phone, address, financial details)
     - Meet in public places for first dates
     - Report suspicious behavior immediately
   - Uses localStorage `heartlink_safety_message_seen` to show only once
   - "I Understand, Continue" button proceeds to chat

**Files Updated:**
- `/app/frontend/src/pages/MatchesPage.jsx` - Added `SafetyMessageModal` component, `getOnlineStatusInfo()` function, color-coded indicators in all tabs
- `/app/frontend/src/pages/ChatPage.jsx` - Added online status color differentiation in chat header

**Testing Status:** ✅ Verified with testing agent and screenshots

---

### Three UI/UX Issues Fixed ✅ (Feb 10, 2025)

**Issues Resolved:**

1. **Online Count Mismatch Fixed** 
   - Added `online_now` field to `/api/admin/dashboard-stats` - counts users active in last 5 minutes
   - Admin Dashboard now shows "🟢 Online Now" card separately from "Active Today"
   - This matches the app's real-time online indicator logic

2. **Modern Location Pin UI**
   - Updated location pin from plain text to modern gradient pill design
   - Blue gradient background with animated pulse dot
   - More visually appealing and consistent with app's design language

3. **Likes Sent Count Display**
   - New endpoint: `GET /api/profile/{user_id}/stats`
   - Returns: likes_sent, likes_received, mutual_matches, superlikes_sent, superlikes_received, profile_views
   - Added "Activity Stats" section on ProfilePage with colorful gradient cards

**Files Updated:**
- `/app/backend/server.py` - Added online_now calculation and /profile/{user_id}/stats endpoint
- `/app/frontend/src/pages/AdminDashboard.jsx` - Added Online Now stat card
- `/app/frontend/src/pages/DiscoverPage.jsx` - Modern location pin styling
- `/app/frontend/src/pages/ProfilePage.jsx` - Activity stats section with likes sent display

---

### Previous Updates

### Admin Panel Fixes ✅ (Updated Feb 1, 2025)

**Problems Fixed:**
1. **User Filters Not Working** - Backend `/api/admin/all-users` was missing filter parameters
2. **OneSignal Integration** - Backend already had OneSignal support, frontend NotificationManager was correctly integrated
3. **Inactive User Targeting** - Added 'inactive' target option for notifications

**Backend Changes:**
1. **Updated `/api/admin/all-users` endpoint** - Added `gender`, `status`, `sort` query parameters
   - Gender filter: `male`, `female`
   - Status filter: `active`, `inactive`, `premium`, `verified`, `banned`
   - Sort options: `newest`, `oldest`, `last_active`, `name`
   
2. **Updated `/api/admin/onesignal/send` endpoint** - Added `inactive` target option
   - Target options: `all`, `male`, `female`, `inactive`
   - Sends to users inactive for 7+ days

**Test Results (96% pass rate):**
- Admin login: ✅ Working
- Dashboard stats: ✅ Working  
- User filters: ✅ All working
- OneSignal status: ✅ Shows "configured" status
- Notification form: ✅ Working with all target options

**Note:** OneSignal APP_ID in `.env` needs valid format (UUID) from user's OneSignal dashboard.

**Files Updated:**
- `/app/backend/server.py` - Enhanced admin endpoints with filters

### Scheduled Notifications & Templates ✅ (Updated Feb 1, 2025)

**New Features Added:**
1. **12 Pre-defined Notification Templates** with categories:
   - Daily: Good Morning, Evening Check-in
   - Engagement: New matches, Profile incomplete
   - Re-engagement: We miss you
   - Promotion: Weekend Special, Profile Boost
   - Safety: Safety Reminder
   - Urgency: Match Expiring
   - Monetization: Premium Offer

2. **Custom Template CRUD:**
   - Create custom templates
   - Edit existing templates
   - Delete templates
   - Filter by category

3. **Scheduled Notification Processor:**
   - Background task runs every minute
   - Automatically sends scheduled notifications via OneSignal
   - Logs all sent notifications
   - Supports all target options (all, male, female, inactive)

**New Backend Endpoints:**
- `GET /api/admin/notification-templates` - Get all templates
- `POST /api/admin/notification-templates` - Create custom template
- `PUT /api/admin/notification-templates/{id}` - Update template
- `DELETE /api/admin/notification-templates/{id}` - Delete template
- `POST /api/admin/schedule-notification` - Schedule a notification
- `GET /api/admin/scheduled-notifications` - Get pending scheduled
- `DELETE /api/admin/scheduled-notification/{id}` - Cancel scheduled

**Frontend Updates:**
- New Templates tab in NotificationManager
- Template categories with color coding
- New Template modal for create/edit
- Schedule tab shows pending notifications
- Quick Templates section in Send Now tab

**Files Updated:**
- `/app/backend/server.py` - Added template CRUD and scheduler processor
- `/app/frontend/src/components/admin/NotificationManager.jsx` - Complete rewrite with new features

---

## Previous Updates (January 2025)

### Security & Data Protection ✅ (Updated Jan 29, 2025)

**COMPREHENSIVE SECURITY FEATURES ADDED:**

1. **JWT Token Authentication**
   - Access tokens (24 hour expiry)
   - Refresh tokens (30 day expiry)
   - Token verification endpoint

2. **Password Security**
   - Bcrypt hashing (upgraded from SHA256)
   - Password strength validation (8+ chars, uppercase, lowercase, number, special char)
   - Auto-migration from old SHA256 hashes

3. **Rate Limiting**
   - Login: 5/minute (prevents brute force)
   - Register: 3/minute (prevents spam)
   - Password reset: 3/minute
   - General API: 100/minute

4. **Suspicious Activity Detection**
   - Failed login tracking
   - Rapid action detection (too many likes, messages)
   - Auto-flagging suspicious IPs

5. **Session Management**
   - View all active sessions
   - Revoke specific sessions
   - Logout from all devices

6. **Input Validation & Sanitization**
   - XSS prevention
   - Script tag removal
   - Email/Phone format validation

7. **Security Audit Logging**
   - Login/logout events
   - Password changes
   - Session revocations

**Files Created/Updated:**
- `/backend/security.py` - NEW: Complete security module
- `/backend/server.py` - Integrated security features

**New Endpoints:**
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout/{user_id}` - Secure logout
- `GET /api/auth/verify-token` - Verify token validity
- `GET /api/security/sessions/{user_id}` - View active sessions
- `POST /api/security/revoke-session` - Revoke specific session
- `POST /api/security/change-password` - Change password
- `GET /api/security/audit-log/{user_id}` - View security log

### Real-time Online/Offline Status ✅ (Updated Jan 29, 2025)

**Changes Made:**
1. **WebSocket Service** - Created `/frontend/src/services/WebSocketService.js` for real-time updates
2. **Batch Status API** - Added `/api/users/online-status` for fetching multiple user statuses at once
3. **Enhanced Caching** - Added online status cache (30 sec TTL) for faster responses
4. **Real-time Updates** - Profiles update instantly when users go online/offline

**Files Created/Updated:**
- `/frontend/src/services/WebSocketService.js` - NEW: WebSocket client service
- `/backend/server.py` - Added batch status endpoints and improved caching

### Server Performance Optimization ✅ (Updated Jan 29, 2025)

**Improvements:**
1. **Online Status Cache** - 30 second TTL cache for status lookups
2. **Likes Cache** - 2 minute TTL cache for likes count
3. **Batch Status API** - Fetch multiple user statuses in single request
4. **Connection Pooling** - Already optimized (50 max, 10 min connections)
5. **MongoDB Indexes** - All critical fields indexed

### Colorful Verified Badge ✅ (Updated Jan 29, 2025)

**New Badge Component:**
- **Gradient Animated Badge** - Blue to purple to pink gradient with shimmer effect
- **Trust Level Badges** - Different colors for low/medium/high trust
- **Premium Badge** - Gold gradient for premium users
- **Animated Online Indicator** - Pulsing green dot for online users

**Files Created:**
- `/frontend/src/components/badges/VerifiedBadge.jsx` - NEW: All badge components

### India Cities Dropdown ✅ (Updated Jan 29, 2025)

**Changes Made:**
1. **All India Cities Added** - Complete list of cities organized by state
2. **State Dropdown** - User first selects state, then city
3. **Searchable City Dropdown** - Filter cities by typing
4. **Popular Cities** - Quick selection for metro cities

**Files Created/Updated:**
- `/frontend/src/data/indianCities.js` - NEW: Complete India cities data
- `/frontend/src/pages/ProfilePage.jsx` - City/State dropdowns
- `/frontend/src/pages/CompleteProfilePage.jsx` - City/State dropdowns for signup

### Likes Page Fix ✅ (Updated Jan 29, 2025)

**Problem:** Profiles were not removing from "Likes You" tab after user liked/passed them.

**Solution Applied:**
1. **Backend action endpoint updated** - Now marks `user2_action` when user takes action
2. **Likes API updated** - Filters out profiles where user already took action
3. **Frontend already had correct logic** - State update was working

**Files Updated:**
- `/backend/server.py` - Fixed `/action` and `/likes` endpoints

### Google Play AD_ID Permission Fix ✅ (Updated Jan 28, 2025)

**Problem:** Play Console rejected the app due to missing AD_ID permission declaration for Android 13+ (API 33+).

**Solution Applied:**
1. **Added `tools:node="replace"`** to AD_ID permission - forces permission across all dependencies
2. **Added `<queries>` block** for Android 11+ (API 30+) - required for proper advertising ID service discovery
3. **Added property tag** to fix AdServices config conflict between ads-lite and measurement-api
4. **Multiple manifest files updated** - main, release, debug, and capacitor-cordova-plugins

**Files Updated:**
- `/frontend/android/app/src/main/AndroidManifest.xml` - Complete AD_ID fix
- `/frontend/android/app/src/release/AndroidManifest.xml` - Release build manifest
- `/frontend/android/app/src/debug/AndroidManifest.xml` - Debug build manifest
- `/frontend/android/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml` - Plugin manifest
- `/frontend/capacitor.config.json` - Fixed appId to com.heartlink.app

**Play Console Action Required:**
1. Build new AAB file with updated manifest
2. Upload to Play Console
3. In "Advertising ID" section, select "Yes" and check "Advertising or marketing" + "Analytics"
4. If error persists, click "Update declaration" → "No" → Save → "Yes" → Save again

### Ad Logic Refactor - Complete ✅ (Updated Jan 28, 2025)

**Changes Made:**
1. **Removed ALL Banner Ads** - No banner ads anywhere in the app
2. **Interstitial Ads After 6 Swipes** - Using centralized `AdsService.js`
3. **Rewarded Ads for +10 Extra Swipes** - User-initiated only
4. **No Ads on Chat/Profile Pages** - Clean experience

**Files Updated:**
- `/frontend/src/services/AdsService.js` - Centralized ad service (NEW)
- `/frontend/src/pages/DiscoverPage.jsx` - Swipe tracking + ad integration
- `/frontend/src/pages/ProfilePage.jsx` - Removed all ad components
- `/frontend/src/components/Navbar.jsx` - Removed banner container
- `/frontend/public/admob.js` - DELETED (old ad logic)
- `/frontend/public/index.html` - Removed admob.js reference

**Ad Logic Summary:**
| Feature | Implementation |
|---------|---------------|
| Banner Ads | ❌ REMOVED |
| Interstitial | Every 6 swipes (male non-premium only) |
| Rewarded | +10 swipes on user request |
| Chat Page | No ads |
| Profile Page | No ads |

### Swipe Counter System
- Daily limit: 50 swipes for free users
- Extra swipes stored in localStorage
- Warning shown at 45 swipes (5 remaining)
- Counter resets at midnight
- "Ad in X swipes" indicator for eligible users

## Core Features

### Implemented Features

#### Phase 1 - Safety & Trust (January 2025) ✅
1. **User Schema Updates** - Gender lock, trust badges, risk scores, women safety mode fields
2. **Performance Optimizations** - MongoDB indexes, connection pooling, in-memory caching
3. **Gender Lock Feature** - Strict gender filtering for profile visibility
4. **Profile Enhancement** - Voice intro, values, relationship intent, lifestyle tags
5. **Safety & Control** - Profile view history, incognito mode, device blocking
6. **Trust UI** - Trust badges on profiles (low/medium/high)
7. **Women Safety Mode** - Verified males only, message delays, quiet hours
8. **Admin Controls** - User settings management, banning, verification

#### Phase 2 - AdMob Integration (January 2025) ✅
1. **Google AdMob Integration**
   - Rewarded Ads: Extra swipes (+10)
   - Interstitial Ads: After every 6 swipes
   - Banner Ads: REMOVED as per user request

2. **Gender-Based Ad Targeting**
   - Female users: Completely AD-FREE experience
   - Male users: See ads (rewarded optional, interstitial limited)
   - Premium users: NO ADS at all

3. **Ad Reward System**
   - Watch ad → +10 extra swipes
   - Watch ad → 30 min profile boost
   - Watch ad → 1 priority message

4. **Premium Subscription System**
   - Monthly (₹299), Quarterly (₹699), Yearly (₹1999)
   - Features: No ads, unlimited swipes, see who liked, profile boost, super likes

5. **Backend Ad Tracking APIs**
   - `/api/ads/impression` - Track ad views
   - `/api/ads/reward` - Apply rewards
   - `/api/ads/stats/{user_id}` - Get ad statistics
   - `/api/ads/frequency-cap/{user_id}` - Check interstitial eligibility
   - `/api/subscription/*` - Subscription management

### Ad Integration Details

| Ad Type | Target | Frequency | Screen |
|---------|--------|-----------|--------|
| Rewarded | Male non-premium | Unlimited (user-initiated) | Discover, Profile |
| Interstitial | Male non-premium | Max 1/day | Home, After boost |
| Banner | Male non-premium | Continuous | Bottom (not in chat) |

### Business Rules
- ❌ Never show ads to female users
- ❌ Never show ads to premium subscribers
- ❌ Never show ads in chat screens
- ✅ Rewarded ads are optional and user-initiated
- ✅ Max 1 interstitial per day per user
- ✅ Track all impressions for analytics

### AdMob Credentials
- App ID: `ca-app-pub-3735972538807236~9004238866`
- Interstitial: `ca-app-pub-3735972538807236/8105078421`
- Rewarded: `ca-app-pub-3735972538807236/8182111801`
- Banner: `ca-app-pub-3735972538807236/9418160097`

### New Frontend Components
| Component | Path | Description |
|-----------|------|-------------|
| AdMobService | `/src/services/adMobService.js` | AdMob SDK wrapper |
| AdContext | `/src/context/AdContext.jsx` | React context for ads |
| RewardedAdButton | `/src/components/ads/RewardedAdButton.jsx` | Watch ad button |
| AdRewardCard | `/src/components/ads/AdRewardCard.jsx` | Reward options card |
| PremiumPage | `/src/pages/PremiumPage.jsx` | Subscription plans |

### New API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/ads/impression | Track ad impression |
| POST | /api/ads/reward | Apply ad reward |
| GET | /api/ads/stats/{user_id} | Get ad statistics |
| GET | /api/ads/frequency-cap/{user_id} | Check frequency cap |
| POST | /api/subscription/create | Create subscription order |
| POST | /api/subscription/activate/{user_id} | Activate premium |
| GET | /api/subscription/status/{user_id} | Get subscription status |

## Tech Stack
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Native App**: Capacitor (Android)
- **Ads**: Google AdMob (@capacitor-community/admob)
- **Storage**: Firebase Storage
- **Notifications**: Firebase Cloud Messaging

## Upcoming Tasks

### P0 - Critical (Blocked)
- [ ] **Android Notification Click Navigation** - Notification clicks redirect to discover page instead of correct destination
  - **Root Cause:** Production frontend at heartlink.co.in has outdated code
  - **Solution:** Deploy updated frontend code from /app/frontend to heartlink.co.in

### P0 - High Priority
- [ ] AI girl chatbot to interact with users
- [ ] Referral system ("Invite a friend, get rewards")
- [ ] Razorpay/Stripe payment integration for subscriptions

### P1 - Medium Priority
- [ ] Message read count not decreasing after reading (needs debugging)
- [ ] AI-based photo verification
- [ ] Screenshot detection and alert feature
- [ ] Chat without match functionality
- [ ] Typing indicators and read receipts

### P2 - Lower Priority
- [ ] AI Trust Score algorithm
- [ ] Advanced reporting system
- [ ] Redis caching for scalability
- [ ] Refactor server.py into smaller modules

## Test Credentials
- Admin Email: shivamkks112@gmail.com
- Admin Password: Test@123
- Test User 1: femaletest@heartlink.com / Test@123
- Test User 2: demotest@heartlink.com / Test@123 (may not exist)

## Files Modified/Created (This Session)
- `/app/frontend/src/services/adMobService.js` - NEW
- `/app/frontend/src/context/AdContext.jsx` - NEW
- `/app/frontend/src/components/ads/RewardedAdButton.jsx` - NEW
- `/app/frontend/src/components/ads/AdRewardCard.jsx` - NEW
- `/app/frontend/src/pages/PremiumPage.jsx` - NEW
- `/app/frontend/src/pages/DiscoverPage.jsx` - MODIFIED (added ad components)
- `/app/frontend/src/App.js` - MODIFIED (AdProvider, Premium route)
- `/app/frontend/.env` - MODIFIED (AdMob config)
- `/app/frontend/android/app/src/main/AndroidManifest.xml` - MODIFIED (AdMob App ID)
- `/app/backend/server.py` - MODIFIED (Ad & Subscription APIs)
