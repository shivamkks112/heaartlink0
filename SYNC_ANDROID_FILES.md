# 📱 Android Files Ko Local Android Studio Mein Update Karne Ke Instructions

## Issue: Bundle abhi bhi 5MB hai kyunki aapke local machine par files purani hain

---

## ✅ Solution: Ye 4 Files Manually Update Karen

### **File 1: build.gradle**
**Location:** `android/app/build.gradle`

Apne Android Studio mein is file ko open karen aur **line 5, 8, 11, 12** ko update karen:

```gradle
android {
    namespace "com.heartlink.app"               // Line 5 - CHANGE THIS
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.heartlink.app"       // Line 8 - CHANGE THIS
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 10                           // Line 11 - CHANGE THIS
        versionName "2.0.2"                      // Line 12 - CHANGE THIS
```

---

### **File 2: MainActivity.java**
**Location:** `android/app/src/main/java/com/heartlink/app/MainActivity.java`

**IMPORTANT:** Pehle folder structure change karen:
1. `java/com/heartlink/` folder mein jayen
2. `dating` folder ka naam change karke `app` karen
3. `MainActivity.java` ko open karen aur **Line 1** change karen:

```java
package com.heartlink.app;  // CHANGE from com.heartlink.dating

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
```

---

### **File 3: HeartLinkMessagingService.java**
**Location:** `android/app/src/main/java/com/heartlink/app/HeartLinkMessagingService.java`

Is file ko bhi same folder mein move karen aur **Line 1** update karen:

```java
package com.heartlink.app;  // CHANGE from com.heartlink.dating
```

---

### **File 4: google-services.json** 🔥 **MOST IMPORTANT**
**Location:** `android/app/google-services.json`

Aapne jo Firebase Console se download kiya tha wo complete file copy-paste karen.

---

## 🔧 Android Studio Mein Steps:

1. ✅ Upar di gayi saari files update karen
2. ✅ File → Sync Project with Gradle Files
3. ✅ Build → Clean Project
4. ✅ Build → Rebuild Project  
5. ✅ Build → Generate Signed Bundle / APK

**Expected Result:** Bundle size **15-30MB+** hona chahiye!

---

## ⚠️ Common Mistakes:

❌ Sirf ek file update karna - SABHI 4 files update karni zaruri hai
❌ Folder structure change nahi karna - `dating` → `app` rename karna zaruri hai
❌ google-services.json purani hi rahne dena

✅ SABHI changes karne ke baad hi Clean + Rebuild karen

---

Agar phir bhi issue ho, toh error message screenshot share karen!
