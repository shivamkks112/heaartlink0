# HeartLink - Premium Safety Dating App PRD

## Original Problem Statement
Build a modern, safe, trust-based dating app for Android called "HeartLink" for Indian users. The app focuses on creating a premium, respectful, safe dating experience with emphasis on genuine users and female safety.

## Core Features

### Implemented (Phase 1) - January 2025

#### 1. User Schema Updates ✅
New fields added to User model:
- `gender` (male/female/non-binary)
- `show_to_gender` (male/female/both)
- `gender_lock_enabled` (boolean)
- `hide_profile_from_gender` (male/female/none)
- `last_active` (datetime)
- `bio_voice_intro_url` (string)
- `intro_video_url` (string)
- `trust_badge_level` (low/medium/high)
- `risk_score` (0-100, admin visible only)
- `is_verified_male` (boolean)
- `about_me` (extended bio)
- `values` (array: respect, family, ambition, spirituality, freedom)
- `relationship_intent` (serious, casual, friendship, marriage)
- `lifestyle_tags` (array: non-smoker, vegetarian, fitness, travel, etc.)
- `profile_viewers` (array of last viewers)
- `device_ids`, `blocked_device_ids` (for device blocking)
- `women_safety_mode`, `night_quiet_hours_enabled`
- `is_shadow_banned`, `is_permanently_banned`, `ban_reason`

#### 2. Gender Lock Feature ✅
- Users can enable strict gender filtering
- `show_to_gender` controls who sees your profile
- `hide_profile_from_gender` hides profile from specific gender
- Applied in discover endpoint

#### 3. Profile Enhancement ✅
- About Me (extended text)
- Voice Intro (15 sec recording)
- Intro Video (optional upload)
- Values selector (5 options)
- Relationship Intent picker (4 options)
- Lifestyle tags (8 options)

#### 4. Safety & Control Features ✅
- Profile view history (last 5 viewers)
- Incognito mode (browse without being seen)
- Block by device ID
- Screenshot alert endpoint (POST /api/user/{id}/screenshot-alert)

#### 5. Trust UI ✅
- Trust badge displayed on profiles (low/medium/high)
- Badge shown in Discover page cards
- Admin can set trust_badge_level

#### 6. Women Safety Mode ✅
- Only verified males can message when enabled
- 2-minute first message delay for males
- Night quiet hours (10pm-7am IST auto mute)
- Settings visible only to female users

#### 7. Admin Controls ✅
- PUT /api/admin/user-settings - Update user safety settings
- Toggle gender lock, verification, trust badge
- Shadow ban / permanent ban
- View pending voice/video intros
- View high risk users (risk_score > 50)

#### 8. Filters ✅
- Filter discover by relationship_intent
- Filter by trust_badge_level
- Filter by last_active (hours)
- Excludes is_shadow_banned and is_permanently_banned users

### API Endpoints (Phase 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | /api/user/{id}/gender-lock | Update gender lock settings |
| PUT | /api/user/{id}/profile-enhancement | Update values, intent, lifestyle |
| PUT | /api/user/{id}/women-safety | Toggle women safety mode |
| GET | /api/user/{id}/profile-viewers | Get last 5 profile viewers |
| POST | /api/user/{id}/track-view | Track profile view |
| POST | /api/user/{id}/block-device | Block a device ID |
| POST | /api/user/{id}/register-device | Register device ID |
| POST | /api/user/{id}/screenshot-alert | Alert about screenshot |
| PUT | /api/admin/user-settings | Admin user management |
| GET | /api/admin/pending-intros | Get pending voice/video intros |
| GET | /api/admin/high-risk-users | Get users with risk_score > 50 |

### Frontend Pages (Phase 1)

| Route | Page | Features |
|-------|------|----------|
| /privacy | Privacy & Safety | Visibility, Gender Lock, Women Safety, Trust Badge |
| /enhance-profile | Profile Enhancement | About Me, Values, Intent, Lifestyle, Voice/Video |
| /profile-viewers | Profile Viewers | Total views, Recent viewers list |

## Tech Stack
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Native App**: Capacitor (Android)
- **Storage**: Firebase Storage (voice/video intros)
- **Notifications**: Firebase Cloud Messaging

## Testing Status
- Backend: 34/34 tests PASS (100%)
- Frontend: All pages verified working

## Upcoming Tasks (Phase 2)

### P0 - High Priority
- [ ] Screenshot detection native implementation (Capacitor plugin)
- [ ] AI Trust Score algorithm implementation
- [ ] Instant Match feature

### P1 - Medium Priority  
- [ ] Chat without match functionality
- [ ] Typing indicators and read receipts
- [ ] Admin dashboard UI for new controls

### P2 - Lower Priority
- [ ] Data merge from heartlink-dating-1
- [ ] Advanced reporting system
- [ ] User verification flow (selfie/ID)

## System Tone
The app should feel:
- Calm and emotionally mature
- Safe and respectful
- Premium quality
- NOT hookup or spammy

## Test Credentials
- Email: shivam.fresh@heartlink.com
- Password: Shivam@#110
- User ID: 4f67c382-84dd-4cf1-a455-d554210fd47c
