package com.heartlink.app;

import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
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

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickListener;
import com.onesignal.notifications.INotificationClickEvent;

import org.json.JSONObject;

import java.util.Arrays;

public class MainActivity extends BridgeActivity {
    
    private static final String ONESIGNAL_APP_ID = "ad0b57dc-908b-4d84-8654-d6b5dd50684e";
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
        
        // Initialize OneSignal
        initializeOneSignal();
        
        // Create high importance notification channel for heads-up popups
        createNotificationChannel();
        
        // Check for pending navigation
        checkPendingNavigation();
        
        Log.d(TAG, "HeartLink started");
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
    
    private void initializeOneSignal() {
        try {
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
            
            OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
                @Override
                public void onClick(INotificationClickEvent event) {
                    Log.d(TAG, "*** NOTIFICATION CLICKED ***");
                    handleNotificationClick(event);
                }
            });
            
            // Request notification permission for Android 13+
            if (Build.VERSION.SDK_INT >= 33) {
                OneSignal.getNotifications().requestPermission(true, null);
            }
            
            Log.d(TAG, "OneSignal initialized");
        } catch (Exception e) {
            Log.e(TAG, "OneSignal error: " + e.getMessage());
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            final String CHANNEL_ID = "heartlink_high_v2";

            // Clean up legacy channels from earlier builds. Android does NOT allow
            // editing an existing channel's importance/sound after creation, so we
            // must migrate to a new channel id and delete the old ones.
            try {
                if (manager.getNotificationChannel("heartlink_high") != null) {
                    manager.deleteNotificationChannel("heartlink_high");
                }
                if (manager.getNotificationChannel("heartlink_notifications") != null) {
                    manager.deleteNotificationChannel("heartlink_notifications");
                }
            } catch (Exception ignored) {}

            // Idempotent: only create if not already present.
            if (manager.getNotificationChannel(CHANNEL_ID) != null) {
                Log.d(TAG, "Channel already exists: " + CHANNEL_ID);
                return;
            }

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "HeartLink Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Matches, Likes, Messages, Profile Views, Admin");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.enableLights(true);
            channel.setLightColor(0xFFFF6B9D);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            // Attach a sound URI to the channel — required for consistent
            // audio + heads-up popup on Android 8+ (Oreo+).
            android.net.Uri sound = android.media.RingtoneManager.getDefaultUri(
                android.media.RingtoneManager.TYPE_NOTIFICATION
            );
            android.media.AudioAttributes audioAttrs = new android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(sound, audioAttrs);

            manager.createNotificationChannel(channel);
            Log.d(TAG, "Notification channel created: " + CHANNEL_ID + " (IMPORTANCE_HIGH, sound, vibrate, lock-screen visible)");
        }
    }
    
    private void handleNotificationClick(INotificationClickEvent event) {
        try {
            if (event == null || event.getNotification() == null) {
                Log.d(TAG, "Notification event is null");
                return;
            }
            
            JSONObject data = event.getNotification().getAdditionalData();
            String path = null;
            
            Log.d(TAG, "Notification data: " + (data != null ? data.toString() : "null"));
            
            if (data != null) {
                String type = data.optString("type", "");
                String action = data.optString("action", "");
                String matchId = data.optString("match_id", "");
                
                Log.d(TAG, "type=" + type + ", action=" + action + ", matchId=" + matchId);
                
                if ("match".equals(type)) {
                    path = "/matches";
                } else if ("like".equals(type)) {
                    path = "/likes";
                } else if ("message".equals(type)) {
                    path = (matchId != null && !matchId.isEmpty()) ? "/chat/" + matchId : "/matches";
                } else if ("profile_view".equals(type)) {
                    path = "/profile-viewers";
                } else if ("verification".equals(type)) {
                    path = "/profile";
                } else if ("premium".equals(type)) {
                    path = "/premium";
                } else if ("admin".equals(type) || "promotional".equals(type)) {
                    path = "/notifications";
                } else if ("open_matches".equals(action)) {
                    path = "/matches";
                } else if ("open_likes".equals(action)) {
                    path = "/likes";
                } else if ("open_chat".equals(action)) {
                    path = (matchId != null && !matchId.isEmpty()) ? "/chat/" + matchId : "/matches";
                } else if ("open_visitors".equals(action) || "open_profile_views".equals(action)) {
                    path = "/profile-viewers";
                } else if ("open_premium".equals(action)) {
                    path = "/premium";
                } else if ("open_app".equals(action)) {
                    path = "/notifications";
                }
            }
            
            if (path != null) {
                Log.d(TAG, "Target path: " + path);
                savePendingNavigation(path);
                navigateToPath(path);
            } else {
                Log.d(TAG, "No path determined from notification");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void savePendingNavigation(String path) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PENDING_NAV_KEY, path).apply();
        Log.d(TAG, "Saved pending navigation: " + path);
    }
    
    private void checkPendingNavigation() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String path = prefs.getString(PENDING_NAV_KEY, null);
        
        if (path != null && !path.isEmpty()) {
            Log.d(TAG, "Found pending navigation: " + path);
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            navigateToPath(path);
        }
    }
    
    private void navigateToPath(String path) {
        if (isNavigating) {
            Log.d(TAG, "Already navigating, skipping");
            return;
        }
        
        isNavigating = true;
        final String fullUrl = BASE_URL + path;
        Log.d(TAG, "Will navigate to: " + fullUrl);
        
        // Try navigation at multiple intervals
        int[] delays = {2000, 4000, 6000, 8000, 10000};
        
        for (int delay : delays) {
            mainHandler.postDelayed(() -> {
                loadUrlInWebView(fullUrl);
            }, delay);
        }
        
        // Reset flag after last attempt
        mainHandler.postDelayed(() -> {
            isNavigating = false;
        }, 12000);
    }
    
    private void loadUrlInWebView(String url) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                Log.d(TAG, "WebView not ready");
                return;
            }
            
            WebView webView = getBridge().getWebView();
            String currentUrl = webView.getUrl();
            
            Log.d(TAG, "Current: " + currentUrl);
            Log.d(TAG, "Target: " + url);
            
            // Check if already on target page
            String targetPath = url.replace(BASE_URL, "");
            if (currentUrl != null && currentUrl.endsWith(targetPath)) {
                Log.d(TAG, "Already on target page");
                isNavigating = false;
                return;
            }
            
            Log.d(TAG, ">>> LOADING URL: " + url);
            runOnUiThread(() -> {
                webView.loadUrl(url);
            });
            
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
