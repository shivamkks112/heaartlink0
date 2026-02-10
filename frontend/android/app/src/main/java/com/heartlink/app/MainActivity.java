package com.heartlink.app;

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
    private String pendingNavigation = null;
    
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
            
            // Add click listener for notifications
            OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
                @Override
                public void onClick(INotificationClickEvent event) {
                    handleNotificationClick(event);
                }
            });
            
            Log.d(TAG, "OneSignal initialized with click listener");
        } catch (Exception e) {
            Log.e(TAG, "OneSignal error: " + e.getMessage());
        }
        
        Log.d(TAG, "HeartLink started");
    }
    
    private void handleNotificationClick(INotificationClickEvent event) {
        try {
            if (event == null || event.getNotification() == null) {
                Log.d(TAG, "Notification event is null");
                return;
            }
            
            JSONObject data = event.getNotification().getAdditionalData();
            String path = "/notifications"; // Default path
            
            if (data != null) {
                String type = data.optString("type", "");
                String action = data.optString("action", "");
                String matchId = data.optString("match_id", "");
                
                Log.d(TAG, "Notification clicked - type: " + type + ", action: " + action + ", matchId: " + matchId);
                
                // Determine navigation path
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
            }
            
            Log.d(TAG, "Will navigate to: " + path);
            pendingNavigation = path;
            
            // Store in localStorage and navigate multiple times to ensure it works
            storeAndNavigate(path);
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification: " + e.getMessage());
        }
    }
    
    private void storeAndNavigate(String path) {
        // Store path in localStorage first, then navigate
        String storeJs = "localStorage.setItem('heartlink_pending_nav', '" + path + "');";
        
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                runOnUiThread(() -> {
                    webView.evaluateJavascript(storeJs, null);
                    Log.d(TAG, "Stored pending nav: " + path);
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Store error: " + e.getMessage());
        }
        
        // Navigate after delays to ensure WebView is ready
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 1000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 2000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 3000);
    }
    
    private void navigateInWebView(String path) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                Log.d(TAG, "Bridge/WebView is null");
                return;
            }
            
            WebView webView = getBridge().getWebView();
            
            String js = "javascript:(function() {" +
                "try {" +
                "  console.log('HeartLink: Navigating to " + path + "');" +
                "  if (window.__HEARTLINK_NAVIGATE__) {" +
                "    window.__HEARTLINK_NAVIGATE__('" + path + "');" +
                "    localStorage.removeItem('heartlink_pending_nav');" +
                "  } else if (window.location.pathname !== '" + path + "') {" +
                "    window.location.href = '" + path + "';" +
                "  }" +
                "} catch(e) { console.log('Nav error:', e); }" +
                "})()";
            
            runOnUiThread(() -> {
                webView.evaluateJavascript(js, null);
                Log.d(TAG, "Navigate executed: " + path);
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Navigate error: " + e.getMessage());
        }
    }
    
    @Override
    public void onStart() {
        super.onStart();
        
        if (pendingNavigation != null) {
            final String path = pendingNavigation;
            storeAndNavigate(path);
        }
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
