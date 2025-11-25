# 📱 HeartLink Native Android App - Build Guide

## 🚀 Quick Build Steps

### 1. Install Dependencies (If not done)
```bash
cd /app/frontend
yarn install
```

### 2. Build React App
```bash
yarn build
```

### 3. Sync Capacitor
```bash
npx cap sync android
```

### 4. Open in Android Studio
```bash
npx cap open android
```

---

## 🔧 Android Studio Build Process

### Step 1: Gradle Sync
1. Android Studio खुलने के बाद wait करें
2. Top-right में "Sync Now" button दिखेगा - click करें
3. Build progress bottom में दिखेगा

### Step 2: Force Dependency Download (If needed)
अगर APK size 6-7 MB आ रहा है:

```bash
# Terminal in Android Studio (या command line)
cd /app/frontend/android
./gradlew clean
./gradlew build --refresh-dependencies
```

### Step 3: Build APK
**Option A: Debug APK (Testing के लिए)**
```
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

**Option B: Release APK (Production के लिए)**
```
Build > Generate Signed Bundle / APK
```

### Step 4: APK Location
```
/app/frontend/android/app/build/outputs/apk/debug/app-debug.apk
या
/app/frontend/android/app/build/outputs/apk/release/app-release.apk
```

---

## ✅ Verification Checklist

### 1. APK Size Check
- **Expected:** 20-25 MB
- **Problem:** 6-7 MB (Firebase dependencies missing)

**Fix:**
```bash
cd /app/frontend/android
./gradlew clean
rm -rf .gradle
./gradlew build
```

### 2. Test Notifications
```bash
# Install APK on device
adb install app-debug.apk

# Send test notification (from backend)
curl -X POST <BACKEND_URL>/api/send-test-notification
```

### 3. Check Firebase Setup
File must exist: `/app/frontend/android/app/google-services.json`

---

## 🔔 Notification Features Implemented

### Native Android Notification Settings:
- ✅ **Sound:** Default notification sound
- ✅ **Vibration:** Pattern [200, 100, 200, 100, 200]
- ✅ **Priority:** HIGH (shows as heads-up)
- ✅ **Channel:** "HeartLink Notifications" (user can customize)

### Notification Types Handled:
1. **New Message** → Opens chat page
2. **New Match** → Opens matches page
3. **New Like** → Opens discover page
4. **Verification** → Opens profile page

---

## 🐛 Common Issues & Solutions

### Issue 1: APK Size Too Small (6-7 MB)
**Cause:** Firebase dependencies not downloading

**Solution:**
```bash
cd /app/frontend/android
./gradlew clean
./gradlew build --refresh-dependencies

# If still failing, delete .gradle folder
rm -rf .gradle
rm -rf app/.gradle
./gradlew build
```

### Issue 2: Notifications Silent
**Cause:** Notification channel settings

**Solution:**
- Delete app and reinstall (clears old channel settings)
- Or: Settings > Apps > HeartLink > Notifications > Check settings

### Issue 3: Build Fails - "google-services.json not found"
**Solution:**
```bash
# Check file exists
ls /app/frontend/android/app/google-services.json

# If missing, download from Firebase Console:
# https://console.firebase.google.com/project/heartlink-6abe9/settings/general
```

### Issue 4: Capacitor Sync Issues
```bash
cd /app/frontend
npx cap sync android --force
```

---

## 📦 Build for Production

### Step 1: Update Version
Edit: `/app/frontend/android/app/build.gradle`
```gradle
versionCode 3  // Increment for each release
versionName "1.0.2"
```

### Step 2: Generate Keystore (First time only)
```bash
keytool -genkey -v -keystore heartlink-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias heartlink
```

### Step 3: Build Signed APK
```
Build > Generate Signed Bundle / APK > APK
- Select keystore file
- Enter passwords
- Select "release" build variant
```

---

## 🎯 Testing Checklist

Before releasing APK:

- [ ] APK size is 20-25 MB
- [ ] App installs successfully
- [ ] Login works
- [ ] Notifications show with sound + vibration
- [ ] Clicking notification opens correct page
- [ ] All pages load properly
- [ ] Chat messages send/receive
- [ ] Camera/photo upload works
- [ ] App doesn't crash

---

## 📱 Install on Device

### Via ADB:
```bash
adb devices  # Check device connected
adb install /path/to/app-debug.apk
```

### Via File Transfer:
1. Copy APK to phone
2. Enable "Install from Unknown Sources"
3. Open APK file
4. Click "Install"

---

## 🚨 Important Notes

1. **Package Name:** `com.heartlink.dating` (don't change)
2. **Firebase:** Project ID: `heartlink-6abe9`
3. **Backend URL:** Configured in `.env` file
4. **Min Android Version:** API 22 (Android 5.1)
5. **Target Android Version:** API 34 (Android 14)

---

## 📞 Need Help?

If build fails:
1. Check Android Studio's "Build" tab for errors
2. Run `./gradlew build` in terminal to see detailed logs
3. Check `google-services.json` file exists
4. Verify internet connection for dependency download

---

## 🔄 Update Existing App

जब नया version release करना हो:

1. Increment `versionCode` in `build.gradle`
2. Build new APK/Bundle
3. Upload to Play Store Console
4. Users को automatic update मिलेगा

---

## ✅ Build Complete Checklist

- [ ] React app built (`yarn build`)
- [ ] Capacitor synced (`npx cap sync android`)
- [ ] Gradle dependencies downloaded
- [ ] APK size correct (20-25 MB)
- [ ] Signed with keystore (for production)
- [ ] Tested on real device
- [ ] Notifications working with sound
- [ ] All features working

---

**Last Updated:** November 2025
**Build Tool Version:** Gradle 8.x, Android Studio 2024.x
