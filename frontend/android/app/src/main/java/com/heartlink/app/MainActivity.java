package com.heartlink.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickListener;
import com.onesignal.notifications.INotificationClickEvent;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    
    private static final String ONESIGNAL_APP_ID = "ad0b57dc-908b-4d84-8654-d6b5dd50684e";
    private static final String TAG = "HeartLink";
    private static final String PREFS_NAME = "HeartLinkPrefs";
    private static final String PENDING_NAV_KEY = "pending_navigation";
    private static final String BASE_URL = "https://heartlink.co.in";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize AdMob
        try {
            MobileAds.initialize(this, initializationStatus -> {
                Log.d(TAG, "AdMob initialized");
            });
        } catch (Exception e) {
            Log.e(TAG, "AdMob error: " + e.getMessage());
        }
        
        // Initialize OneSignal
        try {
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
            
            OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
                @Override
                public void onClick(INotificationClickEvent event) {
                    handleNotificationClick(event);
                }
            });
            
            Log.d(TAG, "OneSignal initialized");
        } catch (Exception e) {
            Log.e(TAG, "OneSignal error: " + e.getMessage());
        }
        
        // Check for pending navigation and redirect
        checkAndRedirect();
        
        Log.d(TAG, "HeartLink started");
    }
    
    private void checkAndRedirect() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String path = prefs.getString(PENDING_NAV_KEY, null);
        
        if (path != null && !path.isEmpty()) {
            Log.d(TAG, "Found pending path: " + path);
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            
            final String fullUrl = BASE_URL + path;
            
            // Try redirect at multiple intervals
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 3000);
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 5000);
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 7000);
        }
    }
    
    private void loadUrl(String url) {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                String currentUrl = webView.getUrl();
                
                // Only redirect if not already on target page
                if (currentUrl == null || !currentUrl.contains(url.replace(BASE_URL, ""))) {
                    Log.d(TAG, "Loading URL: " + url);
                    runOnUiThread(() -> webView.loadUrl(url));
                } else {
                    Log.d(TAG, "Already on correct page: " + currentUrl);
                }
            } else {
                Log.d(TAG, "WebView not ready");
            }
        } catch (Exception e) {
            Log.e(TAG, "Load URL error: " + e.getMessage());
        }
    }
    
    private void handleNotificationClick(INotificationClickEvent event) {
        try {
            if (event == null || event.getNotification() == null) return;
            
            JSONObject data = event.getNotification().getAdditionalData();
            String path = "/notifications";
            
            if (data != null) {
                String type = data.optString("type", "");
                String action = data.optString("action", "");
                String matchId = data.optString("match_id", "");
                
                Log.d(TAG, "Notification clicked - type: " + type + ", action: " + action + ", matchId: " + matchId);
                
                if ("match".equals(type)) {
                    path = "/matches";
                } else if ("like".equals(type)) {
                    path = "/likes";
                } else if ("message".equals(type)) {
                    path = (matchId != null && !matchId.isEmpty()) ? "/chat/" + matchId : "/matches";
                } else if ("open_matches".equals(action)) {
                    path = "/matches";
                } else if ("open_likes".equals(action)) {
                    path = "/likes";
                } else if ("open_chat".equals(action)) {
                    path = (matchId != null && !matchId.isEmpty()) ? "/chat/" + matchId : "/matches";
                }
            }
            
            Log.d(TAG, "Will navigate to: " + path);
            
            // Save to SharedPreferences
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PENDING_NAV_KEY, path).apply();
            
            // Try immediate redirect
            final String fullUrl = BASE_URL + path;
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 2000);
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 4000);
            new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrl(fullUrl), 6000);
            
        } catch (Exception e) {
            Log.e(TAG, "Notification click error: " + e.getMessage());
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
