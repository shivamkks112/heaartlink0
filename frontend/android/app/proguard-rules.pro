# ===================================================================
# HeartLink ProGuard/R8 Rules — Production-safe configuration
# ===================================================================

# ======================== GENERAL ========================

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Preserve annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses,EnclosingMethod

# Don't warn about missing optional dependencies
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn java.lang.invoke.**
-dontwarn javax.annotation.**
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ======================== CAPACITOR ========================

# Keep all Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}

# Capacitor Bridge & WebView JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.Bridge { *; }
-keep class com.getcapacitor.BridgeActivity { *; }
-keep class com.getcapacitor.PluginCall { *; }
-keep class com.getcapacitor.JSObject { *; }
-keep class com.getcapacitor.JSArray { *; }

# Capacitor Cordova compatibility
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }

# ======================== FIREBASE ========================

# Firebase Core
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firebase Messaging (FCM)
-keep class com.google.firebase.messaging.** { *; }
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService { *; }

# Firebase Analytics
-keep class com.google.firebase.analytics.** { *; }

# ======================== GOOGLE ADMOB ========================

-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# ======================== FACEBOOK SDK ========================

-keep class com.facebook.** { *; }
-keep class com.facebook.appevents.** { *; }
-keepclassmembers class * {
    @com.facebook.GraphRequest$GraphJSONObjectCallback *;
}
-dontwarn com.facebook.**

# ======================== WEBVIEW / JS BRIDGE ========================

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class android.webkit.** { *; }

# ======================== MULTIDEX ========================

-keep class androidx.multidex.** { *; }

# ======================== JSON / SERIALIZATION ========================

# Keep model classes that might be serialized
-keepclassmembers class * {
    public <init>();
}
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ======================== OKHTTP / NETWORKING ========================

-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ======================== GOOGLE PLAY BILLING ========================

-keep class com.android.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }
-dontwarn com.android.billingclient.**
-keep class ee.nicko.native_purchases.** { *; }
-dontwarn ee.nicko.native_purchases.**

# ======================== GOOGLE PLAY SERVICES ========================

-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-dontwarn com.google.android.gms.**

# ======================== ANDROIDX ========================

-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**
-keep class com.google.android.material.** { *; }

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
