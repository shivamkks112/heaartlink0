# HeartLink - Premium Safety Dating App PRD

## Original Problem Statement
Build a modern, safe, trust-based dating app for Android called "HeartLink" for Indian users. The app focuses on creating a premium, respectful, safe dating experience with emphasis on genuine users and female safety.

## Latest Update (January 2025)

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

### P0 - High Priority
- [ ] Razorpay/Stripe payment integration for subscriptions
- [ ] Screenshot detection native implementation
- [ ] AI Trust Score algorithm

### P1 - Medium Priority
- [ ] Chat without match functionality
- [ ] Typing indicators and read receipts
- [ ] Native Android app build with AdMob

### P2 - Lower Priority
- [ ] Advanced reporting system
- [ ] AI-based photo verification
- [ ] Redis caching for scalability

## Test Credentials
- Admin Email: shivamkks112@gmail.com
- Admin Password: Test@123

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
