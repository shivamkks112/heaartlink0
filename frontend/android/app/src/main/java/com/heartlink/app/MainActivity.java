package com.heartlink.app;

import android.content.SharedPreferences;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "HeartLink";
    private static final String PREFS_NAME = "HeartLinkPrefs";
    private static final String PENDING_NAV_KEY = "pending_navigation";
    private static final String BASE_URL = "https://heartlink.co.in";
    
    private Handler mainHandler;
    private boolean isNavigating = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        mainHandler = new Handler(Looper.getMainLooper());
        
        // Initialize AdMob
        initializeAdMob();
        
        // Initialize Facebook SDK for Meta Ads attribution
        initializeFacebookSDK();
        
        // Create notification channels (FCM handles push)
        createNotificationChannel();
        
        // Check for pending navigation from notification click
        checkPendingNavigation();
        
        Log.d(TAG, "HeartLink started — API " + Build.VERSION.SDK_INT);
    }
    
    private void initializeAdMob() {
        try {
            RequestConfiguration configuration = new RequestConfiguration.Builder()
                .build();
            MobileAds.setRequestConfiguration(configuration);
            
            MobileAds.initialize(this, initializationStatus -> {
                Log.d(TAG, "AdMob initialized");
            });
        } catch (Exception e) {
            Log.e(TAG, "AdMob error: " + e.getMessage());
        }
    }
    
    private void initializeFacebookSDK() {
        try {
            FacebookSdk.sdkInitialize(getApplicationContext());
            AppEventsLogger.activateApp(getApplication());
            Log.d(TAG, "Facebook SDK initialized — Meta Ads attribution active");
        } catch (Exception e) {
            Log.e(TAG, "Facebook SDK error: " + e.getMessage());
        }
    }
    
    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            "heartlink_high",
            "HeartLink Notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Matches, Likes, Messages, Profile Views");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 300, 200, 300});
        channel.enableLights(true);
        channel.setLightColor(0xFFFF6B9D);
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        
        // Default channel for FCM
        NotificationChannel defaultChannel = new NotificationChannel(
            "heartlink_notifications",
            "General Notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        defaultChannel.setDescription("General HeartLink notifications");
        defaultChannel.setShowBadge(true);
        
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
            manager.createNotificationChannel(defaultChannel);
        }
    }
    
    private void savePendingNavigation(String path) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PENDING_NAV_KEY, path).apply();
    }
    
    private void checkPendingNavigation() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String path = prefs.getString(PENDING_NAV_KEY, null);
        
        if (path != null && !path.isEmpty()) {
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            navigateToPath(path);
        }
    }
    
    private void navigateToPath(String path) {
        if (isNavigating) return;
        
        isNavigating = true;
        final String fullUrl = BASE_URL + path;
        
        int[] delays = {2000, 4000, 6000};
        
        for (int delay : delays) {
            mainHandler.postDelayed(() -> loadUrlInWebView(fullUrl), delay);
        }
        
        mainHandler.postDelayed(() -> isNavigating = false, 8000);
    }
    
    private void loadUrlInWebView(String url) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            
            WebView webView = getBridge().getWebView();
            String currentUrl = webView.getUrl();
            
            String targetPath = url.replace(BASE_URL, "");
            if (currentUrl != null && currentUrl.endsWith(targetPath)) {
                isNavigating = false;
                return;
            }
            
            runOnUiThread(() -> webView.loadUrl(url));
        } catch (Exception e) {
            Log.e(TAG, "Load error: " + e.getMessage());
        }
    }
    
    @Override
    public void onStart() {
        super.onStart();
        checkPendingNavigation();
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        checkPendingNavigation();
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
