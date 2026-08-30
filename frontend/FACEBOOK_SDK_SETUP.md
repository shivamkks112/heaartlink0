# Facebook/Meta SDK Integration for HeartLink

## App ID: 1667563904230292

---

## Step 1: Update `android/app/src/main/res/values/strings.xml`

Add these lines inside `<resources>`:

```xml
<string name="facebook_app_id">1667563904230292</string>
<string name="fb_login_protocol_scheme">fb1667563904230292</string>
<string name="facebook_client_token">YOUR_CLIENT_TOKEN_HERE</string>
```

---

## Step 2: Update `android/app/src/main/AndroidManifest.xml`

Add inside `<application>` tag:

```xml
<!-- Facebook SDK -->
<meta-data 
    android:name="com.facebook.sdk.ApplicationId" 
    android:value="@string/facebook_app_id"/>

<meta-data
    android:name="com.facebook.sdk.ClientToken"
    android:value="@string/facebook_client_token"/>

<!-- Facebook App Events (for tracking installs) -->
<meta-data 
    android:name="com.facebook.sdk.AutoLogAppEventsEnabled"
    android:value="true"/>

<meta-data 
    android:name="com.facebook.sdk.AdvertiserIDCollectionEnabled"
    android:value="true"/>

<!-- Facebook Activity -->
<activity 
    android:name="com.facebook.FacebookActivity"
    android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation"
    android:label="@string/app_name" />

<activity
    android:name="com.facebook.CustomTabActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="@string/fb_login_protocol_scheme" />
    </intent-filter>
</activity>
```

---

## Step 3: Update `android/app/build.gradle`

Add in `dependencies` section:

```gradle
implementation 'com.facebook.android:facebook-android-sdk:latest.release'
```

---

## Step 4: Get Client Token from Meta Developers

1. Go to: https://developers.facebook.com/apps/1667563904230292/settings/advanced/
2. Scroll to "Security" section
3. Copy "Client Token"
4. Replace `YOUR_CLIENT_TOKEN_HERE` in strings.xml

---

## Step 5: Configure Android Platform in Meta Developers

1. Go to: https://developers.facebook.com/apps/1667563904230292/settings/basic/
2. Scroll down and click "Add Platform"
3. Select "Android"
4. Fill in:
   - **Package Name:** `com.heartlink.dating`
   - **Class Name:** `com.heartlink.dating.MainActivity`
   - **Key Hashes:** (Get from Android Studio using command below)

### Get Key Hash:
```bash
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
```

For release key:
```bash
keytool -exportcert -alias YOUR_RELEASE_KEY_ALIAS -keystore YOUR_RELEASE_KEY_PATH | openssl sha1 -binary | openssl base64
```

---

## Step 6: Enable App Events in Meta Developers

1. Go to: https://developers.facebook.com/apps/1667563904230292/
2. Left sidebar → "App Events" or "Events Manager"
3. Enable "App Events"
4. This will track: App Installs, App Opens, etc.

---

## Step 7: Build and Test

```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

---

## After Setup - Meta Ads will track:

✅ App Installs
✅ App Opens  
✅ App Sessions
✅ Custom Events (if added)

---

## Troubleshooting

If installs not showing:
1. Wait 24-48 hours for data to appear
2. Check Key Hash is correctly added
3. Verify Client Token is set
4. Check "App Events" is enabled in Meta Dashboard

