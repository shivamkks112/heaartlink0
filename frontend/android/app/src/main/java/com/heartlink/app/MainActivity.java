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
        
        // Check for pending navigation from SharedPreferences
        checkPendingNavigation();
        
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
            
            // Save to SharedPreferences (persists even if app restarts)
            savePendingNavigation(path);
            
            // Also try to navigate immediately
            storeAndNavigate(path);
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification: " + e.getMessage());
        }
    }
    
    private void savePendingNavigation(String path) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PENDING_NAV_KEY, path).apply();
            Log.d(TAG, "Saved pending nav to prefs: " + path);
        } catch (Exception e) {
            Log.e(TAG, "Error saving to prefs: " + e.getMessage());
        }
    }
    
    private void checkPendingNavigation() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pendingPath = prefs.getString(PENDING_NAV_KEY, null);
            
            if (pendingPath != null && !pendingPath.isEmpty()) {
                Log.d(TAG, "Found pending nav in prefs: " + pendingPath);
                // Clear it immediately
                prefs.edit().remove(PENDING_NAV_KEY).apply();
                // Navigate after delay
                storeAndNavigate(pendingPath);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking prefs: " + e.getMessage());
        }
    }
    
    private void storeAndNavigate(String path) {
        // Store path in localStorage
        String storeJs = "localStorage.setItem('heartlink_pending_nav', '" + path + "'); console.log('Stored pending nav: " + path + "');";
        
        // Execute multiple times with delays
        new Handler(Looper.getMainLooper()).postDelayed(() -> executeJs(storeJs), 500);
        new Handler(Looper.getMainLooper()).postDelayed(() -> executeJs(storeJs), 1500);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 2000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 3000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 4000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> navigateInWebView(path), 5000);
    }
    
    private void executeJs(String js) {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                runOnUiThread(() -> {
                    webView.evaluateJavascript(js, null);
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "JS execute error: " + e.getMessage());
        }
    }
    
    private void navigateInWebView(String path) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                Log.d(TAG, "Bridge/WebView is null");
                return;
            }
            
            WebView webView = getBridge().getWebView();
            
            String js = "(function() {" +
                "try {" +
                "  console.log('HeartLink Native: Navigating to " + path + "');" +
                "  if (window.__HEARTLINK_NAVIGATE__ && window.location.pathname !== '" + path + "') {" +
                "    window.__HEARTLINK_NAVIGATE__('" + path + "');" +
                "    localStorage.removeItem('heartlink_pending_nav');" +
                "    console.log('Navigation successful');" +
                "  } else if (window.location.pathname !== '" + path + "') {" +
                "    localStorage.setItem('heartlink_pending_nav', '" + path + "');" +
                "    console.log('Stored for later navigation');" +
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
        // Check again when app starts
        checkPendingNavigation();
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
