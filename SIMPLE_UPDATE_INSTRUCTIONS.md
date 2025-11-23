# 🔄 Simple Update - Copy Paste Karo (No Download Needed!)

## Sirf 5 Files Update Karni Hain

**Android Studio mein existing project open karo, phir yeh files update karo:**

---

## File 1: app/build.gradle

**Path:** `android_app/app/build.gradle`

**Poora file delete karo aur yeh paste karo:**

```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'
}

android {
    compileSdk 34

    defaultConfig {
        applicationId "com.heartlink.dating"
        minSdk 21
        targetSdk 34
        versionCode 2
        versionName "1.0.1"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        release {
            storeFile file('../../../android-keys/heartlink.keystore')
            storePassword 'heartlink2025'
            keyAlias 'heartlink-key'
            keyPassword 'heartlink2025'
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
    implementation 'androidx.browser:browser:1.7.0'
    
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    implementation 'com.google.firebase:firebase-analytics:21.5.0'
    
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.work:work-runtime:2.9.0'
    
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
```

✅ Save karo!

---

## File 2: build.gradle (Root)

**Path:** `android_app/build.gradle`

**Poora file replace karo:**

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.0'
        classpath 'com.google.gms:google-services:4.4.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
```

✅ Save karo!

---

## File 3: google-services.json (NEW FILE)

**Path:** `android_app/app/google-services.json`

**Naya file banao aur paste karo:**

```json
{
  "project_info": {
    "project_number": "1234567890",
    "project_id": "heartlink-6abe9",
    "storage_bucket": "heartlink-6abe9.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:1234567890:android:abcdef123456",
        "android_client_info": {
          "package_name": "com.heartlink.dating"
        }
      },
      "oauth_client": [],
      "api_key": [
        {
          "current_key": "AIzaSyDummy_Key_For_HeartLink_Replace_With_Real"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
}
```

✅ Save karo!

---

## File 4: HeartLinkMessagingService.java (NEW FILE)

**Path:** `android_app/app/src/main/java/com/heartlink/dating/HeartLinkMessagingService.java`

**Folder structure:**
```
app/src/main/java/com/heartlink/dating/
```

Agar "com/heartlink/dating" folder nahi hai, toh banao!

**File content:**

```java
package com.heartlink.dating;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class HeartLinkMessagingService extends FirebaseMessagingService {
    private static final String TAG = "HeartLinkFCM";
    private static final String CHANNEL_ID = "heartlink_notifications";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            sendNotification(title, body);
        }

        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data: " + remoteMessage.getData());
        }
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token: " + token);
        sendTokenToServer(token);
    }

    private void sendNotification(String title, String messageBody) {
        Intent intent = new Intent(this, com.google.androidbrowserhelper.trusted.LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_IMMUTABLE
        );

        createNotificationChannel();

        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setAutoCancel(true)
                        .setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        notificationManager.notify(0, notificationBuilder.build());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "HeartLink Notifications",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for likes, matches, and messages");

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void sendTokenToServer(String token) {
        Log.d(TAG, "Token ready to send: " + token);
    }
}
```

✅ Save karo!

---

## File 5: AndroidManifest.xml (UPDATE)

**Path:** `android_app/app/src/main/AndroidManifest.xml`

**Sirf 2 jagah update karna hai:**

### Update 1: Permissions Add Karo

**Existing permissions ke baad add karo:**

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
```

### Update 2: Service Add Karo

**`</application>` se pehle add karo:**

```xml
<!-- Firebase Cloud Messaging Service -->
<service
    android:name=".HeartLinkMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- Firebase Notification Channel -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@mipmap/ic_launcher" />
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/primary_color" />
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="heartlink_notifications" />
```

✅ Save karo!

---

## ✅ After All Files Updated:

### Step 1: Gradle Sync
```
Android Studio:
File → Sync Project with Gradle Files
Wait 2-3 minutes
```

### Step 2: Build APK
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
Wait 5-10 minutes
```

### Step 3: Check APK
```
Size should be: 18-22 MB (not 3 MB!)
Location: app/build/outputs/apk/release/app-release.apk
```

---

## 🎯 Summary:

**5 Files to Update:**
1. ✅ app/build.gradle (copy-paste)
2. ✅ build.gradle (copy-paste)
3. ✅ google-services.json (NEW - create & paste)
4. ✅ HeartLinkMessagingService.java (NEW - create & paste)
5. ✅ AndroidManifest.xml (2 additions)

**Time:** 10 minutes to copy all files

**Then:**
- Gradle Sync (3 min)
- Build APK (10 min)
- Done! ✅

---

**Yeh sabse aasan tarika hai! Download ki zarurat nahi!** 🚀
