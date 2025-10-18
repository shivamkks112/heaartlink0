# 📱 Android Studio - Complete APK Build Process

## 🎯 HeartLink App के लिए Android Studio Setup & APK Generation

---

## 📋 Prerequisites (जो चाहिए)

### 1. **Software Requirements:**
- ✅ Android Studio (latest version)
- ✅ Java JDK 11 or higher
- ✅ Android SDK (API 30+)
- ✅ Node.js & NPM/Yarn (already installed)

### 2. **Project Files:**
- ✅ HeartLink React app (already built)
- ✅ All code changes saved
- ✅ Backend running

---

## 🚀 Step-by-Step Process

### **Phase 1: Prepare React App for Android**

#### **Step 1: Build Production Version**
```bash
# Terminal में run करें
cd /app/frontend
yarn build
```

**यह क्या करेगा:**
- Optimized production build बनाएगा
- `build/` folder में static files generate होंगी
- React app को production-ready बनाएगा

---

#### **Step 2: Install Capacitor (If Not Already)**
```bash
# Check if Capacitor exists
npx cap --version

# If not installed:
yarn add @capacitor/core @capacitor/cli
yarn add @capacitor/android
```

---

#### **Step 3: Initialize Capacitor**
```bash
# Initialize Capacitor config
npx cap init

# When prompted, enter:
App name: HeartLink
App ID: com.heartlink.dating
```

**या manually create करें:** `/app/frontend/capacitor.config.json`
```json
{
  "appId": "com.heartlink.dating",
  "appName": "HeartLink",
  "webDir": "build",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  }
}
```

---

#### **Step 4: Add Android Platform**
```bash
# Add Android platform
npx cap add android

# यह create करेगा: /app/frontend/android/ folder
```

---

#### **Step 5: Sync Web Assets to Android**
```bash
# Sync latest changes
npx cap sync android

# यह copy करेगा:
# - build/ folder → android/app/src/main/assets/public/
# - capacitor.config.json settings
```

---

### **Phase 2: Android Studio Setup**

#### **Step 6: Open Project in Android Studio**
```bash
# Open Android Studio with project
npx cap open android

# या manually:
# Android Studio → Open → /app/frontend/android/
```

**Wait for:**
- ⏳ Gradle sync to complete
- ⏳ Dependencies to download
- ⏳ Project indexing to finish

---

#### **Step 7: Configure App Settings**

**7.1: Check `build.gradle` (Module: app)**

File: `/app/frontend/android/app/build.gradle`

```gradle
android {
    namespace "com.heartlink.dating"
    compileSdk 34
    
    defaultConfig {
        applicationId "com.heartlink.dating"
        minSdk 22
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }
    
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**7.2: Update App Name**

File: `/app/frontend/android/app/src/main/res/values/strings.xml`

```xml
<resources>
    <string name="app_name">HeartLink</string>
    <string name="title_activity_main">HeartLink</string>
</resources>
```

---

#### **Step 8: Add App Icon**

**Icon Requirements:**
- **mipmap-mdpi:** 48x48 px
- **mipmap-hdpi:** 72x72 px
- **mipmap-xhdpi:** 96x96 px
- **mipmap-xxhdpi:** 144x144 px
- **mipmap-xxxhdpi:** 192x192 px

**Place icons in:**
```
/app/frontend/android/app/src/main/res/
├── mipmap-mdpi/ic_launcher.png
├── mipmap-hdpi/ic_launcher.png
├── mipmap-xhdpi/ic_launcher.png
├── mipmap-xxhdpi/ic_launcher.png
└── mipmap-xxxhdpi/ic_launcher.png
```

**या use करें:**
- Android Studio → Right-click `res/` → New → Image Asset
- Icon Type: Launcher Icons
- Upload your HeartLink icon

---

### **Phase 3: Build APK**

#### **Step 9: Build Debug APK (Testing)**

**Method 1: Via Menu**
```
Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

**Method 2: Via Terminal**
```bash
cd /app/frontend/android
./gradlew assembleDebug
```

**Output Location:**
```
/app/frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

#### **Step 10: Build Release APK (Production)**

**10.1: Generate Signing Key**
```bash
# Terminal में run करें
keytool -genkey -v -keystore heartlink-release.keystore -alias heartlink -keyalg RSA -keysize 2048 -validity 10000

# Enter details when prompted:
Password: [your password]
Name: HeartLink
Organization: Your Company
City: Your City
State: Your State
Country: IN
```

**Save keystore:**
```
/app/frontend/android/app/heartlink-release.keystore
```

---

**10.2: Configure Signing**

File: `/app/frontend/android/app/build.gradle`

```gradle
android {
    ...
    
    signingConfigs {
        release {
            storeFile file('heartlink-release.keystore')
            storePassword 'your_password'
            keyAlias 'heartlink'
            keyPassword 'your_password'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

**10.3: Build Release APK**

**Via Terminal:**
```bash
cd /app/frontend/android
./gradlew assembleRelease
```

**Via Android Studio:**
```
Build → Generate Signed Bundle / APK
→ Select APK
→ Next
→ Choose existing keystore: heartlink-release.keystore
→ Enter passwords
→ Next
→ Select release
→ Finish
```

**Output Location:**
```
/app/frontend/android/app/build/outputs/apk/release/app-release.apk
```

---

### **Phase 4: Testing APK**

#### **Step 11: Install on Device**

**Method 1: USB Connection**
```bash
# Enable USB debugging on phone
# Connect phone via USB
adb install app-debug.apk

# या
adb install app-release.apk
```

**Method 2: Direct Install**
```
- Copy APK to phone
- Open file manager
- Tap APK file
- Install
```

---

#### **Step 12: Test Features**

**Test Checklist:**
```
□ App opens successfully
□ Login page loads
□ Email login works
□ Discover page shows profiles
□ Swipe functionality works
□ Matches page displays
□ Chat works
□ Profile editing works
□ Push notifications (if configured)
□ Bottom navigation works
□ All pages accessible
□ No crashes
```

---

### **Phase 5: Optimization (Optional)**

#### **Enable ProGuard (Reduce APK Size)**

File: `/app/frontend/android/app/proguard-rules.pro`

```proguard
# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class capacitor.** { *; }

# Keep WebView
-keep class android.webkit.** { *; }

# React Native / Capacitor Bridge
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
```

---

#### **Reduce APK Size Tips:**

1. **Remove unused resources:**
```gradle
android {
    buildTypes {
        release {
            shrinkResources true
            minifyEnabled true
        }
    }
}
```

2. **Enable App Bundle (AAB):**
```bash
./gradlew bundleRelease
```

3. **Optimize images:**
- Use WebP format
- Compress PNGs
- Remove unused assets

---

## 📊 APK Size Expectations

**Target Size:**
- Debug APK: ~15-25 MB
- Release APK (unoptimized): ~10-20 MB
- Release APK (optimized): ~8-15 MB

**What affects size:**
- React bundle size
- Images & assets
- Dependencies
- Native libraries

---

## 🐛 Common Issues & Solutions

### **Issue 1: Gradle Sync Failed**
```bash
Solution:
- File → Invalidate Caches / Restart
- Delete .gradle folder
- Rebuild project
```

### **Issue 2: Build Failed**
```bash
Solution:
- Check build.gradle syntax
- Update Gradle version
- Clean project: ./gradlew clean
```

### **Issue 3: APK Not Installing**
```bash
Solution:
- Enable "Install from Unknown Sources"
- Check minimum SDK version
- Uninstall old version first
```

### **Issue 4: White Screen on Launch**
```bash
Solution:
- Check capacitor.config.json
- Verify webDir: "build"
- Run: npx cap sync android
- Rebuild APK
```

### **Issue 5: Navigation Not Working**
```bash
Solution:
- Clear app data
- Reinstall fresh
- Check console logs via Chrome inspect
```

---

## 🎯 Quick Commands Reference

```bash
# Build React app
yarn build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android

# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Install on device
adb install app-release.apk

# View logs
adb logcat | grep Capacitor
```

---

## 📱 Distribution Options

### **Option 1: Direct APK Distribution**
- Share APK file directly
- Users install manually
- No store approval needed
- Quick deployment

### **Option 2: Play Store (Recommended)**
- Professional distribution
- Automatic updates
- Better user trust
- Requires Google Play Console account

### **Option 3: App Bundle (AAB)**
```bash
./gradlew bundleRelease
# Upload to Play Store
```

---

## ✅ Final Checklist

**Before Distribution:**
```
□ App tested on multiple devices
□ All features working
□ No crashes or bugs
□ Icons & splash screen set
□ App name correct
□ Version number set
□ Signed with release keystore
□ ProGuard enabled
□ APK size optimized
□ Privacy policy link added
□ Terms of service ready
```

---

## 🎊 Summary

**Complete Process:**
```
1. Build React app (yarn build)
2. Initialize Capacitor
3. Add Android platform
4. Sync assets (npx cap sync)
5. Open Android Studio
6. Configure app settings
7. Build APK (debug/release)
8. Test on device
9. Optimize & sign
10. Distribute!
```

**Time Required:**
- First time setup: ~2-3 hours
- Subsequent builds: ~10-15 minutes

---

## 🚀 Next Steps

**After APK is Ready:**
1. **Test thoroughly** on real devices
2. **Fix any bugs** found
3. **Optimize performance**
4. **Prepare for Play Store** (if needed)
5. **Share with users** or publish

**For Play Store Submission:**
- Create developer account ($25 one-time)
- Prepare screenshots (phone & tablet)
- Write description (English + Hindi)
- Set privacy policy URL
- Upload APK/AAB
- Submit for review

---

**अब आप ready हैं Android Studio में APK build करने के लिए!** 🎉

**Start with:** `yarn build` and then follow the steps! 🚀
