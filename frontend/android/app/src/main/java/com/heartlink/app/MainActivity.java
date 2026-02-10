package com.heartlink.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;

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
    private String targetPath = null;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        mainHandler = new Handler(Looper.getMainLooper());
        
        // Check pending navigation from SharedPreferences FIRST
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        targetPath = prefs.getString(PENDING_NAV_KEY, null);
        if (targetPath != null) {
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            Log.d(TAG, "Found pending navigation: " + targetPath);
        }
        
        // Initialize AdMob with proper configuration
        initializeAdMob();
        
        // Initialize OneSignal
        initializeOneSignal();
        
        // Schedule navigation if we have a pending path
        if (targetPath != null) {
            scheduleNavigation(targetPath);
        }
        
        Log.d(TAG, "HeartLink MainActivity started");
    }
    
    private void initializeAdMob() {
        try {
            // Set test device IDs if needed (remove in production)
            RequestConfiguration configuration = new RequestConfiguration.Builder()
                .setTestDeviceIds(Arrays.asList("TEST_DEVICE_ID"))
                .build();
            MobileAds.setRequestConfiguration(configuration);
            
            // Initialize the Mobile Ads SDK
            MobileAds.initialize(this, initializationStatus -> {
                Log.d(TAG, "AdMob SDK initialized successfully");
                // Log adapter status
                initializationStatus.getAdapterStatusMap().forEach((adapter, status) -> {
                    Log.d(TAG, "Adapter: " + adapter + " Status: " + status.getInitializationState());
                });
            });
            
            Log.d(TAG, "AdMob initialization started");
        } catch (Exception e) {
            Log.e(TAG, "AdMob initialization error: " + e.getMessage());
        }
    }
    
    private void initializeOneSignal() {
        try {
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
            
            // Set notification click listener
            OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
                @Override
                public void onClick(INotificationClickEvent event) {
                    handleNotificationClick(event);
                }
            });
            
            Log.d(TAG, "OneSignal initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "OneSignal initialization error: " + e.getMessage());
        }
    }
    
    private void handleNotificationClick(INotificationClickEvent event) {
        Log.d(TAG, "=== NOTIFICATION CLICKED ===");
        
        try {
            if (event == null || event.getNotification() == null) {
                Log.d(TAG, "Event or notification is null");
                return;
            }
            
            JSONObject data = event.getNotification().getAdditionalData();
            String path = "/notifications"; // Default
            
            if (data != null) {
                String type = data.optString("type", "");
                String action = data.optString("action", "");
                String matchId = data.optString("match_id", "");
                
                Log.d(TAG, "Notification data - type: " + type + ", action: " + action + ", matchId: " + matchId);
                
                // Determine path based on notification type
                if ("match".equals(type)) {
                    path = "/matches";
                } else if ("like".equals(type)) {
                    path = "/likes";
                } else if ("message".equals(type)) {
                    if (matchId != null && !matchId.isEmpty()) {
                        path = "/chat/" + matchId;
                    } else {
                        path = "/matches";
                    }
                } else if ("open_matches".equals(action)) {
                    path = "/matches";
                } else if ("open_likes".equals(action)) {
                    path = "/likes";
                } else if ("open_chat".equals(action)) {
                    if (matchId != null && !matchId.isEmpty()) {
                        path = "/chat/" + matchId;
                    } else {
                        path = "/matches";
                    }
                }
            } else {
                Log.d(TAG, "No additional data in notification");
            }
            
            Log.d(TAG, "Target path: " + path);
            
            // Save to SharedPreferences for persistence
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PENDING_NAV_KEY, path).apply();
            
            // Set target path
            targetPath = path;
            
            // Schedule navigation
            scheduleNavigation(path);
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification click: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void scheduleNavigation(String path) {
        if (path == null || path.isEmpty()) return;
        
        final String fullUrl = BASE_URL + path;
        Log.d(TAG, "Scheduling navigation to: " + fullUrl);
        
        // Cancel any previous scheduled navigations
        mainHandler.removeCallbacksAndMessages(null);
        
        // Schedule multiple attempts
        mainHandler.postDelayed(() -> attemptNavigation(fullUrl), 2000);
        mainHandler.postDelayed(() -> attemptNavigation(fullUrl), 4000);
        mainHandler.postDelayed(() -> attemptNavigation(fullUrl), 6000);
        mainHandler.postDelayed(() -> attemptNavigation(fullUrl), 8000);
    }
    
    private void attemptNavigation(String url) {
        try {
            if (getBridge() == null) {
                Log.d(TAG, "Bridge is null");
                return;
            }
            
            WebView webView = getBridge().getWebView();
            if (webView == null) {
                Log.d(TAG, "WebView is null");
                return;
            }
            
            String currentUrl = webView.getUrl();
            Log.d(TAG, "Current URL: " + currentUrl + ", Target: " + url);
            
            // Extract path from URLs for comparison
            String targetPath = url.replace(BASE_URL, "");
            boolean alreadyOnPage = currentUrl != null && currentUrl.contains(targetPath);
            
            if (!alreadyOnPage) {
                Log.d(TAG, ">>> NAVIGATING TO: " + url);
                runOnUiThread(() -> {
                    webView.loadUrl(url);
                });
            } else {
                Log.d(TAG, "Already on target page, skipping");
                // Clear the target
                this.targetPath = null;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Navigation error: " + e.getMessage());
        }
    }
    
    @Override
    public void onStart() {
        super.onStart();
        
        // Check again for pending navigation
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String pendingPath = prefs.getString(PENDING_NAV_KEY, null);
        
        if (pendingPath != null && !pendingPath.isEmpty()) {
            Log.d(TAG, "onStart: Found pending path: " + pendingPath);
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            scheduleNavigation(pendingPath);
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
