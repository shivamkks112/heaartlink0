# 📱 HeartLink APK Build Guide - Android Studio

## 🚀 Complete Step-by-Step Instructions

### Prerequisites:
- ✅ Android Studio installed
- ✅ Project files: `/app/android_app/`
- ✅ Keystore: `/app/android-keys/heartlink.keystore`

---

## Step 1: Download Project Files

**Option A: From Emergent Platform**
```
Download: /app/heartlink-android-project.zip (21 KB)
Extract folder: android_app/
```

**Option B: Use Git (if connected)**
```bash
git pull origin main
cd android_app
```

---

## Step 2: Open Project in Android Studio

1. **Launch Android Studio**

2. **Open Project:**
   - File → Open
   - Navigate to: `android_app/` folder
   - Click "OK"

3. **Wait for Gradle Sync:**
   - Android Studio will automatically sync Gradle
   - This may take 2-5 minutes first time
   - Watch bottom status bar for progress

4. **If Gradle Sync Fails:**
   - File → Invalidate Caches / Restart
   - Tools → SDK Manager → Install latest SDK
   - Retry sync

---

## Step 3: Configure Signing (One-time Setup)

### Method A: Using Build Variants (Easiest)

1. **Open Build Variants:**
   - View → Tool Windows → Build Variants
   - Select "release" (instead of debug)

2. **Signing is already configured in build.gradle!**
   ```gradle
   signingConfigs {
       release {
           storeFile file('../../android-keys/heartlink.keystore')
           storePassword 'heartlink2025'
           keyAlias 'heartlink-key'
           keyPassword 'heartlink2025'
       }
   }
   ```

### Method B: Manual Signing Dialog

If you prefer GUI:

1. **Build → Generate Signed Bundle / APK**
2. Select **APK** → Next
3. **Create new / Choose existing key store:**
   - Key store path: `/android-keys/heartlink.keystore`
   - Password: `heartlink2025`
   - Key alias: `heartlink-key`
   - Key password: `heartlink2025`
4. Click Next

---

## Step 4: Build APK

### Quick Build (Release APK):

**Option A: Menu Build**
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
Wait 2-5 minutes
Look for notification: "APK(s) generated successfully"
Click "locate" link
```

**Option B: Gradle Panel**
```
1. View → Tool Windows → Gradle
2. android_app → Tasks → build
3. Double-click "assembleRelease"
4. Wait for build to complete
```

**Option C: Terminal (in Android Studio)**
```bash
cd android_app
./gradlew assembleRelease
```

---

## Step 5: Find Your APK

### Default Location:
```
/app/android_app/app/build/outputs/apk/release/app-release.apk
```

### APK Details:
- **Name:** app-release.apk
- **Size:** ~15-20 MB
- **Signed:** Yes (with your keystore)
- **Ready for:** Play Store upload or direct install

---

## Step 6: Test APK

### Install on Connected Device:

**Option A: Via Android Studio**
```
1. Connect Android phone via USB
2. Enable "USB Debugging" on phone
3. Run → Select Device → Your Phone
4. Or drag APK to Android Studio → Install
```

**Option B: Manual Install**
```
1. Copy app-release.apk to phone
2. Open APK file on phone
3. Click "Install"
4. Allow "Install from unknown sources" if asked
5. Open HeartLink app!
```

---

## Step 7: Verify Notifications

After installing:

1. **Open HeartLink app**
2. **Login with test account:**
   - Email: shivam.fresh@heartlink.com
   - Password: Shivam@#110

3. **Allow Notification Permission**
   - Popup will appear automatically
   - Click "Allow"

4. **Test Notification:**
   - Use another device/account
   - Like your profile
   - Check if notification appears (WhatsApp style!)

---

## 🐛 Troubleshooting

### Issue: Gradle Sync Failed

**Solution:**
```
1. File → Settings → Build → Gradle
2. Gradle JDK: Select "Embedded JDK (17)"
3. Click Apply → OK
4. File → Sync Project with Gradle Files
```

### Issue: SDK Not Found

**Solution:**
```
1. Tools → SDK Manager
2. SDK Platforms tab → Install Android 14.0 (API 34)
3. SDK Tools tab → Install:
   - Android SDK Build-Tools 34
   - Android SDK Platform-Tools
   - Android Emulator (optional)
4. Click Apply
```

### Issue: Build Failed - "Could not find keystore"

**Solution:**
```
1. Check keystore path in app/build.gradle
2. Should be: ../../android-keys/heartlink.keystore
3. Or use absolute path: /full/path/to/android-keys/heartlink.keystore
```

### Issue: Signature Verification Failed

**Solution:**
```
Verify keystore details:
- File: android-keys/heartlink.keystore
- Store password: heartlink2025
- Key alias: heartlink-key
- Key password: heartlink2025
```

---

## 📦 Build Output Summary

After successful build:

```
✅ APK Location:
   android_app/app/build/outputs/apk/release/app-release.apk

✅ File Details:
   Size: ~15-20 MB
   Package: com.heartlink.dating
   Version: 1.0.0
   Signed: Yes

✅ Ready For:
   - Direct installation (testing)
   - Play Store upload
   - Beta distribution
```

---

## 🚀 Play Store Upload (Next Step)

Once APK is tested and working:

1. **Login to Play Console:**
   - https://play.google.com/console

2. **Create New App:**
   - All apps → Create app
   - App name: HeartLink
   - Default language: English/Hindi
   - App type: App
   - Free/Paid: Free

3. **Upload APK:**
   - Production → Create new release
   - Upload: app-release.apk
   - Fill app details (screenshots, description)
   - Submit for review

4. **Review Time:** 1-3 days

---

## 🎯 Quick Reference

### Build Commands:
```bash
# Debug APK (for testing)
./gradlew assembleDebug

# Release APK (for production)
./gradlew assembleRelease

# Clean build
./gradlew clean assembleRelease

# Install on connected device
./gradlew installRelease
```

### Important Paths:
```
Project: /app/android_app/
Keystore: /app/android-keys/heartlink.keystore
Output: android_app/app/build/outputs/apk/release/
```

### Keystore Details:
```
Password: heartlink2025
Alias: heartlink-key
Valid: Until 2053
```

---

## ✅ Expected Timeline

**First Time Build:**
- Gradle sync: 2-5 minutes
- Build APK: 3-5 minutes
- **Total: 5-10 minutes**

**Subsequent Builds:**
- Clean build: 2-3 minutes
- Incremental build: 30-60 seconds

---

## 🎉 Success Checklist

After building:

- [ ] APK file generated
- [ ] File size ~15-20 MB
- [ ] Installed on test device
- [ ] App opens successfully
- [ ] Login works
- [ ] Pages load correctly
- [ ] Notification permission requested
- [ ] Notifications work (test with like)
- [ ] All features functional
- [ ] No crashes

---

## 📞 Need Help?

**Common Issues:**
- Gradle sync problems → Update Android Studio
- Build fails → Check SDK versions
- Signature errors → Verify keystore path
- App crashes → Check logs in Logcat

**Resources:**
- Android Studio docs: https://developer.android.com/studio
- Gradle docs: https://gradle.org/
- TWA guide: https://developer.chrome.com/docs/android/trusted-web-activity/

---

## 🎊 Summary

**You have everything needed:**
- ✅ Complete Android project
- ✅ Configured for HeartLink
- ✅ Signing key ready
- ✅ Build files updated

**Just:**
1. Open Android Studio
2. Open project folder
3. Click Build APK
4. Wait 5 minutes
5. Done! 🚀

**APK will be ready for:**
- Testing on your device
- Beta distribution
- Play Store submission

Good luck! Notification feature native app mein perfectly kaam karega! 🔔
