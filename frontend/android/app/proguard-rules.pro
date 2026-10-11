# ===================================================================
# HeartLink ProGuard/R8 Rules — Optimized for Play Store compliance
# Target: >25% obfuscation
# ===================================================================

# ======================== GENERAL ========================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*
-keepattributes Signature,Exceptions
-keepattributes InnerClasses,EnclosingMethod

-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn java.lang.invoke.**
-dontwarn javax.annotation.**

# ======================== CAPACITOR (must keep) ========================
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor Cordova compatibility
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }

# ======================== FIREBASE (targeted) ========================
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService { *; }
-keep class com.google.firebase.iid.FirebaseInstanceId { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ======================== GOOGLE ADMOB ========================
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.ads.**

# ======================== GOOGLE PLAY BILLING ========================
-keep class com.android.billingclient.api.** { *; }
-dontwarn com.android.billingclient.**
-keep class ee.nicko.native_purchases.** { *; }

# ======================== WEBVIEW / JS BRIDGE ========================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ======================== MULTIDEX ========================
-keep class androidx.multidex.MultiDexApplication { *; }

# ======================== SERIALIZATION ========================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    !static !transient <fields>;
}

# ======================== NETWORKING ========================
-dontwarn okhttp3.**
-dontwarn okio.**

# ======================== NATIVE METHODS ========================
-keepclasseswithmembernames class * {
    native <methods>;
}

# ======================== ENUMS ========================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ======================== PARCELABLE ========================
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ======================== R CLASS ========================
-keepclassmembers class **.R$* {
    public static <fields>;
}

# ======================== CAPGO OTA UPDATER ========================
-keep class ee.nicko.capacitor_updater.** { *; }
