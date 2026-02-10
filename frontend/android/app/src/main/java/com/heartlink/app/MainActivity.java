package com.heartlink.app;

import android.content.SharedPreferences;
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
    private static final String BASE_URL = "https://heartlink.co.in";
    private String pendingPath = null;
    private boolean hasNavigated = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Check for pending navigation FIRST
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        pendingPath = prefs.getString(PENDING_NAV_KEY, null);
        if (pendingPath != null) {
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            Log.d(TAG, "Found pending path: " + pendingPath);
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
        
        // Setup WebView after delay
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            setupWebView();
        }, 1000);
        
        Log.d(TAG, "HeartLink started");
    }
    
    private void setupWebView() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                // Retry after delay
                new Handler(Looper.getMainLooper()).postDelayed(() -> setupWebView(), 500);
                return;
            }
            
            WebView webView = getBridge().getWebView();
            Log.d(TAG, "WebView ready, pendingPath: " + pendingPath);
            
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    Log.d(TAG, "Page loaded: " + url);
                    
                    String navPath = getPendingNavigation();
                    
                    if (navPath != null && !hasNavigated) {
                        hasNavigated = true;
                        Log.d(TAG, "Will redirect to: " + navPath);
                        
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            redirectToPath(view, navPath);
                        }, 2000);
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Setup error: " + e.getMessage());
        }
    }
    
    private String getPendingNavigation() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String path = prefs.getString(PENDING_NAV_KEY, null);
        if (path != null) {
            prefs.edit().remove(PENDING_NAV_KEY).apply();
            return path;
        }
        if (pendingPath != null) {
            String p = pendingPath;
            pendingPath = null;
            return p;
        }
        return null;
    }
    
    private void redirectToPath(WebView webView, String path) {
        if (webView == null || path == null) return;
        
        String fullUrl = BASE_URL + path;
        Log.d(TAG, "Redirecting to: " + fullUrl);
        
        runOnUiThread(() -> {
            try {
                webView.loadUrl(fullUrl);
            } catch (Exception e) {
                Log.e(TAG, "Redirect error: " + e.getMessage());
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
                
                Log.d(TAG, "Notification: type=" + type + ", action=" + action);
                
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
            
            Log.d(TAG, "Saving path: " + path);
            
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PENDING_NAV_KEY, path).apply();
            
            hasNavigated = false;
            pendingPath = path;
            
            if (getBridge() != null && getBridge().getWebView() != null) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    redirectToPath(getBridge().getWebView(), path);
                }, 1500);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error: " + e.getMessage());
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
