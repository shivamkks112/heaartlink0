package com.heartlink.app;

import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
    private String pendingPath = null;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Check for pending navigation FIRST
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        pendingPath = prefs.getString(PENDING_NAV_KEY, null);
        if (pendingPath != null) {
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            Log.d(TAG, "Found pending path on create: " + pendingPath);
        }
        
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
        
        Log.d(TAG, "HeartLink started");
    }
    
    @Override
    public void onWebViewReady(WebView webView) {
        super.onWebViewReady(webView);
        
        Log.d(TAG, "WebView is ready, pending path: " + pendingPath);
        
        // Set custom WebViewClient to handle page load
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "Page finished loading: " + url);
                
                // Check SharedPreferences for pending navigation
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String navPath = prefs.getString(PENDING_NAV_KEY, null);
                
                if (navPath != null && !navPath.isEmpty()) {
                    Log.d(TAG, "Navigating after page load: " + navPath);
                    prefs.edit().remove(PENDING_NAV_KEY).apply();
                    navigateWithRetry(view, navPath);
                } else if (pendingPath != null && !pendingPath.isEmpty()) {
                    Log.d(TAG, "Navigating from pendingPath: " + pendingPath);
                    navigateWithRetry(view, pendingPath);
                    pendingPath = null;
                }
            }
        });
    }
    
    private void navigateWithRetry(WebView webView, String path) {
        // Try navigation multiple times
        for (int delay : new int[]{500, 1000, 2000, 3000, 5000}) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                doNavigate(webView, path);
            }, delay);
        }
    }
    
    private void doNavigate(WebView webView, String path) {
        if (webView == null) return;
        
        String js = "(function() {" +
            "console.log('HeartLink: Attempting navigation to " + path + "');" +
            "console.log('Current path:', window.location.pathname);" +
            "if (window.location.pathname === '" + path + "') {" +
            "  console.log('Already on correct page');" +
            "  return;" +
            "}" +
            "if (typeof window.__HEARTLINK_NAVIGATE__ === 'function') {" +
            "  console.log('Using __HEARTLINK_NAVIGATE__');" +
            "  window.__HEARTLINK_NAVIGATE__('" + path + "');" +
            "} else {" +
            "  console.log('Using direct navigation');" +
            "  window.location.href = '" + path + "';" +
            "}" +
            "})();";
        
        runOnUiThread(() -> {
            try {
                webView.evaluateJavascript(js, result -> {
                    Log.d(TAG, "Navigation JS result: " + result);
                });
            } catch (Exception e) {
                Log.e(TAG, "Navigation error: " + e.getMessage());
            }
        });
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
                
                Log.d(TAG, "Notification: type=" + type + ", action=" + action + ", matchId=" + matchId);
                
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
            
            Log.d(TAG, "Saving navigation path: " + path);
            
            // Save to SharedPreferences
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PENDING_NAV_KEY, path).apply();
            
            // Also set pendingPath
            pendingPath = path;
            
            // Try to navigate if WebView is ready
            if (getBridge() != null && getBridge().getWebView() != null) {
                navigateWithRetry(getBridge().getWebView(), path);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Notification click error: " + e.getMessage());
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
