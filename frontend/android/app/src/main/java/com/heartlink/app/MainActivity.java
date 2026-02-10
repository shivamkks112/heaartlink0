package com.heartlink.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    
    private static final String ONESIGNAL_APP_ID = "ad0b57dc-908b-4d84-8654-d6b5dd50684e";
    private static final String TAG = "HeartLink";
    private String pendingNavigationPath = null;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize AdMob
        MobileAds.initialize(this, initializationStatus -> {
            Log.d(TAG, "AdMob initialized");
        });
        
        // Initialize OneSignal
        OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        OneSignal.getNotifications().requestPermission(true, null);
        
        // Add notification click listener
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                try {
                    JSONObject data = event.getNotification().getAdditionalData();
                    if (data != null) {
                        String type = data.optString("type", "");
                        String action = data.optString("action", "");
                        String matchId = data.optString("match_id", "");
                        
                        Log.d(TAG, "Notification clicked - Type: " + type + ", Action: " + action);
                        
                        // Determine navigation path based on notification type
                        String navigationPath = getNavigationPath(type, action, matchId);
                        
                        if (navigationPath != null && !navigationPath.isEmpty()) {
                            // Navigate in WebView
                            navigateToPath(navigationPath);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error handling notification click: " + e.getMessage());
                }
            }
        });
        
        // Check if app was opened from notification
        handleIntentData(getIntent());
        
        Log.d(TAG, "HeartLink started with notification handler");
    }
    
    private String getNavigationPath(String type, String action, String matchId) {
        switch (type) {
            case "match":
                return "/matches";
            case "like":
                return "/likes";
            case "message":
                if (matchId != null && !matchId.isEmpty()) {
                    return "/chat/" + matchId;
                }
                return "/matches";
            case "admin":
            case "promotion":
                return "/notifications";
            default:
                // Use action as fallback
                switch (action) {
                    case "open_matches":
                        return "/matches";
                    case "open_likes":
                        return "/likes";
                    case "open_chat":
                        return "/matches";
                    case "open_notifications":
                        return "/notifications";
                    default:
                        return null;
                }
        }
    }
    
    private void navigateToPath(String path) {
        runOnUiThread(() -> {
            try {
                // Get the WebView from Capacitor bridge
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    // Execute JavaScript to navigate
                    String jsCode = String.format(
                        "if(window.location.pathname !== '%s') { " +
                        "  window.history.pushState({}, '', '%s'); " +
                        "  window.dispatchEvent(new PopStateEvent('popstate')); " +
                        "  if(window.__HEARTLINK_NAVIGATE__) { window.__HEARTLINK_NAVIGATE__('%s'); } " +
                        "}", 
                        path, path, path
                    );
                    webView.evaluateJavascript(jsCode, null);
                    Log.d(TAG, "Navigated to: " + path);
                } else {
                    // Store path for later if WebView not ready
                    pendingNavigationPath = path;
                    Log.d(TAG, "WebView not ready, storing path: " + path);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error navigating: " + e.getMessage());
                pendingNavigationPath = path;
            }
        });
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntentData(intent);
    }
    
    private void handleIntentData(Intent intent) {
        if (intent != null && intent.getExtras() != null) {
            Bundle extras = intent.getExtras();
            String type = extras.getString("type", "");
            String action = extras.getString("action", "");
            String matchId = extras.getString("match_id", "");
            
            if (!type.isEmpty() || !action.isEmpty()) {
                String path = getNavigationPath(type, action, matchId);
                if (path != null) {
                    pendingNavigationPath = path;
                }
            }
        }
    }
    
    @Override
    public void onStart() {
        super.onStart();
        // Check for pending navigation after WebView is ready
        if (pendingNavigationPath != null) {
            // Delay to ensure WebView is fully loaded
            getBridge().getWebView().postDelayed(() -> {
                navigateToPath(pendingNavigationPath);
                pendingNavigationPath = null;
            }, 1000);
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
