# HeartLink - AdMob Complete Setup Guide

## 📋 Aapke AdMob Credentials
```
App ID: ca-app-pub-3735972538807236~9004238866
Banner: ca-app-pub-3735972538807236/9418160097
Interstitial: ca-app-pub-3735972538807236/8105078421
Rewarded: ca-app-pub-3735972538807236/8182111801
```

---

## 🔧 Step 1: Install AdMob Plugin

Terminal mein ye command run karo (project folder mein):

```bash
cd C:\Users\7mani\Desktop\HeartlinkApp\frontend
npm install @capacitor-community/admob
npx cap sync android
```

---

## 🔧 Step 2: Update capacitor.config.json

File: `frontend/capacitor.config.json`

```json
{
  "appId": "com.heartlink.dating",
  "appName": "HeartLink",
  "webDir": "build",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#ff6b9d",
      "showSpinner": false,
      "androidScaleType": "CENTER_CROP"
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    },
    "LocalNotifications": {
      "smallIcon": "ic_stat_icon_config_sample",
      "iconColor": "#ff6b9d",
      "sound": "beep.wav"
    },
    "AdMob": {
      "appId": "ca-app-pub-3735972538807236~9004238866",
      "requestTrackingAuthorization": true,
      "initializeForTesting": false
    }
  },
  "server": {
    "androidScheme": "https",
    "cleartext": true
  }
}
```

---

## 🔧 Step 3: Update AndroidManifest.xml

File: `frontend/android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    
    <!-- AdMob AD_ID permission - REQUIRED -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:label="@string/title_activity_main"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".HeartLinkMessagingService"
            android:exported="false"
            android:directBootAware="true">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- Firebase Notification Config -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_launcher" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorPrimary" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="heartlink_notifications" />

        <!-- ⭐ Google AdMob App ID - REQUIRED ⭐ -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-3735972538807236~9004238866"/>
            
        <!-- AdMob Optimization Flag -->
        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION"
            android:value="true"/>
        <meta-data
            android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING"
            android:value="true"/>

    </application>

</manifest>
```

---

## 🔧 Step 4: Update app/build.gradle

File: `frontend/android/app/build.gradle`

```gradle
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services'

android {
    namespace "com.heartlink.app"
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.heartlink.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 11
        versionName "2.0.3"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        
        // Multi-dex support for large apps
        multiDexEnabled true
        
        aaptOptions {
            ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
        debug {
            minifyEnabled false
            shrinkResources false
        }
    }
    
    // Java 17 compatibility
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

repositories {
    flatDir{
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
}

dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation project(':capacitor-android')
    
    // Firebase
    implementation 'com.google.firebase:firebase-messaging:23.4.1'
    implementation 'com.google.firebase:firebase-analytics:21.5.1'
    implementation 'com.google.android.gms:play-services-base:18.3.0'
    
    // ⭐ Google AdMob - REQUIRED ⭐
    implementation 'com.google.android.gms:play-services-ads:23.0.0'
    
    // Multi-dex support
    implementation 'androidx.multidex:multidex:2.0.1'
    
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
    implementation project(':capacitor-cordova-android-plugins')
}

apply from: 'capacitor.build.gradle'
```

---

## 🔧 Step 5: Update MainActivity.java

File: `frontend/android/app/src/main/java/com/heartlink/app/MainActivity.java`

```java
package com.heartlink.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize AdMob SDK
        MobileAds.initialize(this, new OnInitializationCompleteListener() {
            @Override
            public void onInitializationComplete(InitializationStatus initializationStatus) {
                // AdMob SDK initialized successfully
                System.out.println("HeartLink: AdMob SDK initialized");
            }
        });
    }
}
```

---

## 🔧 Step 6: Sync and Build

Terminal mein ye commands run karo:

```bash
# Step 1: Build React app
cd C:\Users\7mani\Desktop\HeartlinkApp\frontend
npm run build

# Step 2: Sync with Capacitor
npx cap sync android

# Step 3: Open Android Studio
npx cap open android
```

---

## 🔧 Step 7: Android Studio mein Build

1. **File → Sync Project with Gradle Files**
2. **Build → Clean Project**
3. **Build → Rebuild Project**
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## ⚠️ Common Errors & Solutions

### Error 1: "AdMob App ID not found"
**Solution:** Check AndroidManifest.xml has correct `com.google.android.gms.ads.APPLICATION_ID` meta-data tag.

### Error 2: "Missing AD_ID permission"
**Solution:** Add this line in AndroidManifest.xml:
```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID" />
```

### Error 3: "Cannot resolve symbol MobileAds"
**Solution:** Add this in app/build.gradle dependencies:
```gradle
implementation 'com.google.android.gms:play-services-ads:23.0.0'
```

### Error 4: "Ads not showing"
**Reasons:**
1. AdMob account verification pending (wait 24-48 hours)
2. Test device not added in AdMob console
3. App not approved yet

**For Testing:** Use test ad IDs:
```
Banner: ca-app-pub-3940256099942544/6300978111
Interstitial: ca-app-pub-3940256099942544/1033173712
Rewarded: ca-app-pub-3940256099942544/5224354917
```

### Error 5: "Multidex error"
**Solution:** Add in defaultConfig:
```gradle
multiDexEnabled true
```
And in dependencies:
```gradle
implementation 'androidx.multidex:multidex:2.0.1'
```

---

## ✅ Verification Checklist

- [ ] capacitor.config.json has AdMob plugin config
- [ ] AndroidManifest.xml has APPLICATION_ID meta-data
- [ ] AndroidManifest.xml has AD_ID permission
- [ ] app/build.gradle has play-services-ads dependency
- [ ] MainActivity.java initializes MobileAds
- [ ] npm install @capacitor-community/admob done
- [ ] npx cap sync android done
- [ ] Gradle sync successful
- [ ] Build APK successful

---

## 📱 Test on Real Device

1. Connect phone via USB
2. Enable USB Debugging
3. In Android Studio: Run → Select Device → Your Phone
4. Click Run button (green play icon)

---

## 🎯 AdMob Console Settings

1. Go to https://admob.google.com
2. Apps → HeartLink → App Settings
3. Verify App ID matches: `ca-app-pub-3735972538807236~9004238866`
4. Check app-ads.txt verification status
5. Add test devices for testing

---

Done! Yeh guide follow karo aur AdMob permanently fix ho jayega! 🚀
