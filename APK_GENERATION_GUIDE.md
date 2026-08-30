# 🔧 HeartLink APK Generation Guide

## Step 1: Android Studio Setup

### Download & Install Android Studio
1. **Download:** https://developer.android.com/studio
2. **Install** Android Studio with default settings
3. **Setup SDK:** Accept licenses and download SDK components

### Import Project
1. **Open Android Studio**
2. **File → Open** 
3. **Navigate to:** `/app/android_app/` folder
4. **Select** the project folder
5. **Wait** for Gradle sync to complete

---

## Step 2: Create Keystore (Digital Signature)

### Method A: Android Studio GUI
1. **Build → Generate Signed Bundle/APK**
2. **Choose:** APK
3. **Click:** "Create new..." keystore
4. **Fill Details:**
   - **Keystore path:** `/path/to/heartlink-keystore.jks`
   - **Password:** (Strong password - save it!)
   - **Key alias:** heartlink-key
   - **Key password:** (Same as keystore or different)
   - **Validity:** 25 years
   - **Certificate info:**
     - First Name: Your Name
     - Organization: HeartLink
     - City: Your City
     - State: Your State  
     - Country Code: IN

### Method B: Command Line
```bash
# Navigate to project directory
cd /app/android_app/

# Generate keystore
keytool -genkey -v -keystore heartlink-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias heartlink-key

# Follow prompts and enter:
# - Keystore password
# - Key password  
# - Your details (Name, Organization, etc.)
```

---

## Step 3: Generate Signed APK

### Method A: Android Studio (Recommended)
1. **Build → Generate Signed Bundle/APK**
2. **Select:** APK
3. **Choose your keystore** (created in Step 2)
4. **Enter passwords**
5. **Build variant:** release
6. **Signature versions:** V1 and V2 (both checked)
7. **Click:** Finish

### Method B: Command Line
```bash
# Navigate to project
cd /app/android_app/

# Build release APK
./gradlew assembleRelease

# Sign the APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore heartlink-keystore.jks app/build/outputs/apk/release/app-release-unsigned.apk heartlink-key

# Zipalign (optimize)
zipalign -v 4 app/build/outputs/apk/release/app-release-unsigned.apk HeartLink-v1.0.0-signed.apk
```

---

## Step 4: Alternative - Easy Online Method

### Using Online APK Generator (Fastest)
1. **Visit:** https://appmaker.xyz/pwa-to-apk
2. **Enter PWA URL:** `https://india-dating-app.preview.emergentagent.com`
3. **Fill App Details:**
   - App Name: HeartLink
   - Package Name: com.heartlink.dating
   - Version: 1.0.0
4. **Upload Icon:** 512x512px (use HeartLink logo)
5. **Generate APK**
6. **Download** signed APK file

### Or Use PWABuilder (Microsoft)
1. **Visit:** https://www.pwabuilder.com
2. **Enter URL:** `https://india-dating-app.preview.emergentagent.com`
3. **Click:** "Start"  
4. **Choose:** Android package
5. **Download** generated APK

---

## Step 5: Test APK Before Submission

### Install on Android Device
```bash
# Enable USB Debugging on your Android phone
# Connect phone to computer

# Install APK
adb install HeartLink-v1.0.0-signed.apk

# Or manually:
# - Transfer APK to phone
# - Enable "Install unknown apps"  
# - Tap APK file to install
```

### Test Checklist
- [ ] App launches properly
- [ ] All pages load correctly
- [ ] Login/signup works
- [ ] Navigation functions
- [ ] Matches page loads
- [ ] Chat functionality
- [ ] Admin panel (if admin)
- [ ] Profile editing
- [ ] Photo uploads work

---

## Step 6: Upload to Play Store

### Prepare Upload Bundle (AAB - Recommended)
```bash
# Generate App Bundle (preferred by Google)
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

### Play Console Upload
1. **Login:** https://play.google.com/console
2. **Create New App**
3. **Upload AAB/APK** 
4. **Complete Store Listing** (use provided descriptions)
5. **Add Screenshots** 
6. **Submit for Review**

---

## 📱 Quick Start - No Android Studio Required

### Option 1: GitHub Codespaces (Free)
1. **Upload project to GitHub**
2. **Open in Codespaces** 
3. **Run commands:**
```bash
# Install Android SDK
wget https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip
unzip commandlinetools-linux-8512546_latest.zip

# Set environment
export ANDROID_HOME=/workspace/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

# Build APK
cd android_app
./gradlew assembleRelease
```

### Option 2: Online Builder (Easiest)
1. **PWABuilder.com** - Enter your PWA URL
2. **Download APK** - Ready in 5 minutes
3. **Test & Upload** to Play Store

---

## 🔒 Security Best Practices

### Keystore Security
- **Backup keystore file** (you can't recover it!)
- **Store passwords securely** (password manager)
- **Never share keystore** publicly
- **Keep multiple backups** (cloud + offline)

### APK Verification
```bash
# Verify APK signature
jarsigner -verify -verbose -certs HeartLink-v1.0.0-signed.apk

# Check APK details  
aapt dump badging HeartLink-v1.0.0-signed.apk
```

---

## 🚀 Expected Output

### Successful Build
```
✅ APK Generated: HeartLink-v1.0.0-signed.apk
✅ Size: ~15-25 MB
✅ Package: com.heartlink.dating  
✅ Version: 1.0.0 (Code: 1)
✅ Min SDK: Android 5.0+ (API 21)
✅ Target SDK: Android 14 (API 34)
```

### File Locations
- **Signed APK:** `app/build/outputs/apk/release/`
- **App Bundle:** `app/build/outputs/bundle/release/`
- **Keystore:** `heartlink-keystore.jks` (backup this!)

---

## 📞 Help & Troubleshooting  

### Common Issues
- **Gradle sync failed:** Update Android Studio
- **Keystore not found:** Check file path
- **Build errors:** Clean project (`./gradlew clean`)
- **APK too large:** Enable ProGuard minification

### Need Help?
- **Android Developer Guide:** https://developer.android.com/studio/publish
- **Play Console Help:** https://support.google.com/googleplay/android-developer
- **Stack Overflow:** Search for specific error messages

---

## 🎯 Quick Summary

**Fastest Method:**
1. **Use PWABuilder.com** with your PWA URL
2. **Download APK** (ready in 5 minutes)
3. **Upload to Play Store**

**Professional Method:**  
1. **Install Android Studio**
2. **Import TWA project**
3. **Generate keystore**
4. **Build signed APK**
5. **Upload to Play Console**

**Total time:** 30 minutes to 2 hours (depending on method)

Your HeartLink app is ready for Play Store! 🚀💕