# HeartLink Android Setup - README
# ================================
# Yeh file git pull ke baad automatically sab configure kar degi

## IMPORTANT: Git Pull ke Baad Kya Karna Hai

### Option 1: Simple Commands (Recommended)
```powershell
# Windows PowerShell me run karo:
cd frontend
npm install
npx cap sync android
```

Bas! Ab Android Studio me open karo aur build karo.

### Option 2: Full Reset (Agar kuch bhi kaam na kare)
```powershell
# 1. Pehle backup lo
Copy-Item -Path "android/app/src/main/res/mipmap-*" -Destination "android-backup/" -Recurse -Force
Copy-Item -Path "heartlink-release-key.jks" -Destination "android-backup/" -Force

# 2. Fresh sync
npx cap sync android --force

# 3. Restore icons (agar gayab ho gaye)
Copy-Item -Path "android-backup/mipmap-*" -Destination "android/app/src/main/res/" -Recurse -Force
```

## Files Jo Repository Me Already Hain:

✅ `android/app/src/main/res/xml/gma_ad_services_config.xml` - AdMob config
✅ `android/app/src/main/res/values/strings.xml` - Facebook App ID
✅ `android/app/src/main/res/values/colors.xml` - App colors
✅ `android/app/src/main/AndroidManifest.xml` - All permissions & configs
✅ `capacitor.config.json` - Plugin configurations

## Keystore Location:
Apna `heartlink-release-key.jks` file HAMESHA `frontend/` folder me rakho.
Git me commit mat karo (already .gitignore me hai).

## Agar AdMob Error Aaye:
Error: `xml/gma_ad_services_config not found`

Solution: File already hai at:
`android/app/src/main/res/xml/gma_ad_services_config.xml`

Agar nahi hai toh create karo:
```xml
<?xml version="1.0" encoding="utf-8"?>
<gma-ad-services-config>
    <ad-service name="AdMob" enabled="true"/>
</gma-ad-services-config>
```

## Plugin Versions (package.json me hain):
- @capacitor-community/admob: ^7.2.0
- @capacitor-community/facebook-login: ^6.0.0
- @capacitor-firebase/authentication: ^6.3.1
- @capacitor/local-notifications: ^6.2.1
- @capacitor/geolocation: ^6.0.2
- capacitor-plugin-safe-area: ^3.0.4

## Quick Troubleshoot:
1. Gradle Error → `cd android && ./gradlew clean`
2. Plugin Missing → `npm install && npx cap sync android`
3. Icons Missing → Restore from backup
4. Build Failed → Check `android/variables.gradle` versions
