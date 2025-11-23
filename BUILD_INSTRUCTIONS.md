# HeartLink TWA Build Instructions

## 📱 Building the Android App (TWA)

### Prerequisites Installed:
- ✅ Node.js v20.19.5
- ✅ Bubblewrap CLI
- ⚠️ JDK required (bubblewrap will install)

### Step 1: Generate Signing Key
```bash
# Create keystore (do once)
keytool -genkey -v -keystore android-keys/heartlink.keystore \
  -alias heartlink-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass heartlink2025 \
  -keypass heartlink2025 \
  -dname "CN=HeartLink, OU=Dating, O=HeartLink, L=Delhi, ST=Delhi, C=IN"
```

### Step 2: Initialize TWA Project
```bash
cd /app
bubblewrap init --manifest=twa-manifest.json
```

### Step 3: Build APK
```bash
cd /app/heartlink-twa
bubblewrap build
```

### Step 4: Output
- **Debug APK:** `/app/heartlink-twa/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK:** `/app/heartlink-twa/app/build/outputs/apk/release/app-release.apk`

### File Sizes:
- Debug APK: ~20-25 MB
- Release APK: ~15-20 MB (optimized)

### Installation:
```bash
# Install on connected device
adb install app-debug.apk
```

### Play Store Upload:
- Use `app-release.apk`
- Or generate AAB: `bubblewrap build --release`

## 🔔 Notifications Setup

Firebase already configured in:
- `/app/backend/.env` - Service Account JSON
- `/app/frontend/.env` - VAPID key

Native notifications will work automatically once TWA is installed!

## 📦 App Details

**Package Name:** com.heartlink.dating
**Version:** 1.0.0
**Min SDK:** Android 7.0 (API 24)
**Target SDK:** Android 14 (API 34)

**Features:**
- ✅ Native Android app
- ✅ Push notifications (WhatsApp-style)
- ✅ Offline caching
- ✅ Home screen icon
- ✅ Splash screen
- ✅ App shortcuts

## 🚀 Quick Build (Automated)

For quick testing without Java setup, you can use:
1. GitHub Actions (CI/CD)
2. Android Studio Cloud Build
3. Appcircle.io (free tier)

