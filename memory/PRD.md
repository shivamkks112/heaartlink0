# HeartLink - Premium Safety Dating App PRD

## Original Problem Statement
Build a modern, safe, trust-based dating app for Android called "HeartLink" for Indian users. The app focuses on creating a premium, respectful, safe dating experience with emphasis on genuine users and female safety.

## Latest Update (January 2025)

### Rewarded Ads - Complete Implementation ✅
Three new rewarded ad features have been implemented:

1. **Out of Swipes Modal** (`/src/components/ads/OutOfSwipesModal.jsx`)
   - Shows when daily swipe limit (50) is reached
   - "Free Swipes Pao!" - Watch ad for +10 extra swipes
   - "Premium Upgrade" button for unlimited access
   - Hinglish text for Indian users

2. **See Who Liked You Cards** (`/src/components/ads/SeeWhoLikedYouCard.jsx`)
   - First 2 profiles show normally
   - Remaining profiles are blurred with lock icon
   - "Ad Dekho, Profile Dekho" button to reveal
   - Premium users see all profiles without blur

3. **Profile Page Ad Rewards** 
   - AdRewardCard component added to Profile page
   - Three reward options: Extra Swipes, Profile Boost, Priority Message
   - Only visible to male, non-premium users

### Swipe Counter System
- Daily limit: 50 swipes for free users
- Extra swipes stored in localStorage
- Warning shown at 45 swipes (5 remaining)
- Counter resets at midnight

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

#### Phase 2 - AdMob Integration (January 2025) ✅ NEW
1. **Google AdMob Integration**
   - Rewarded Ads: Extra swipes, profile boost, priority messages
   - Interstitial Ads: Max 1 per day per user
   - Banner Ads: Bottom of screen (optional)

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
