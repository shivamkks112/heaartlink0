package com.heartlink.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    
    private static final String ONESIGNAL_APP_ID = "ad0b57dc-908b-4d84-8654-d6b5dd50684e";
    private static final String TAG = "HeartLink";
    private static final String BASE_URL = "https://heartlink.co.in";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize Google Mobile Ads SDK
        MobileAds.initialize(this, new OnInitializationCompleteListener() {
            @Override
            public void onInitializationComplete(InitializationStatus initializationStatus) {
                Log.d(TAG, "AdMob SDK initialized successfully");
            }
        });
        
        // Initialize OneSignal
        initializeOneSignal();
        
        // Handle notification click if app was opened from notification
        handleNotificationIntent(getIntent());
    }
    
    private void initializeOneSignal() {
        // Enable verbose logging for debugging (disable in production)
        OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
        
        // Initialize OneSignal
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        
        // Request notification permission
        OneSignal.getNotifications().requestPermission(true, null);
        
        // Set notification click listener
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                try {
                    JSONObject data = event.getNotification().getAdditionalData();
                    Log.d(TAG, "Notification clicked with data: " + (data != null ? data.toString() : "null"));
                    
                    String targetUrl = BASE_URL;
                    
                    if (data != null) {
                        String type = data.optString("type", "");
                        String action = data.optString("action", "");
                        
                        // Determine destination based on notification type
                        switch (type) {
                            case "match":
                                targetUrl = BASE_URL + "/matches";
                                break;
                            case "message":
                                targetUrl = BASE_URL + "/matches";
                                break;
                            case "like":
                                targetUrl = BASE_URL + "/likes";
                                break;
                            case "superlike":
                                targetUrl = BASE_URL + "/likes";
                                break;
                            case "admin":
                                targetUrl = BASE_URL + "/discover";
                                break;
                            default:
                                // Check action as fallback
                                if (action.contains("match") || action.contains("chat")) {
                                    targetUrl = BASE_URL + "/matches";
                                } else if (action.contains("like")) {
                                    targetUrl = BASE_URL + "/likes";
                                } else {
                                    targetUrl = BASE_URL + "/discover";
                                }
                                break;
                        }
                    }
                    
                    Log.d(TAG, "Navigating to: " + targetUrl);
                    
                    // Navigate to the target URL
                    navigateToUrl(targetUrl);
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling notification click: " + e.getMessage());
                    navigateToUrl(BASE_URL + "/discover");
                }
            }
        });
        
        Log.d(TAG, "OneSignal initialized successfully");
    }
    
    private void navigateToUrl(String url) {
        try {
            // If bridge is available, use it to load the URL
            if (getBridge() != null && getBridge().getWebView() != null) {
                runOnUiThread(() -> {
                    getBridge().getWebView().loadUrl(url);
                });
            } else {
                // Fallback: Open in browser or restart activity
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error navigating to URL: " + e.getMessage());
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }
    
    private void handleNotificationIntent(Intent intent) {
        if (intent != null && intent.getExtras() != null) {
            Bundle extras = intent.getExtras();
            Log.d(TAG, "Intent extras: " + extras.toString());
            
            // Check for OneSignal data
            String type = extras.getString("type", "");
            if (!type.isEmpty()) {
                String targetUrl = BASE_URL;
                
                switch (type) {
                    case "match":
                    case "message":
                        targetUrl = BASE_URL + "/matches";
                        break;
                    case "like":
                    case "superlike":
                        targetUrl = BASE_URL + "/likes";
                        break;
                    default:
                        targetUrl = BASE_URL + "/discover";
                        break;
                }
                
                navigateToUrl(targetUrl);
            }
        }
    }
    
    @Override
    public void onBackPressed() {
        // Close app when back button is pressed
        finishAffinity();
    }
}
