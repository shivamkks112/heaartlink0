package com.heartlink.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;

import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

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
        // Enable edge-to-edge display for Android 15+ compatibility
        try {
            EdgeToEdge.enable(this);
        } catch (Exception e) {
            Log.e(TAG, "EdgeToEdge enable failed: " + e.getMessage());
        }
        
        super.onCreate(savedInstanceState);
        
        // Handle window insets for edge-to-edge
        try {
            View mainView = findViewById(android.R.id.content);
            if (mainView != null) {
                ViewCompat.setOnApplyWindowInsetsListener(mainView, (v, windowInsets) -> {
                    Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                    v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                    return WindowInsetsCompat.CONSUMED;
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Window insets setup failed: " + e.getMessage());
        }
        
        // Initialize Google Mobile Ads SDK
        try {
            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(InitializationStatus initializationStatus) {
                    Log.d(TAG, "AdMob SDK initialized successfully");
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "AdMob initialization failed: " + e.getMessage());
        }
        
        // Initialize OneSignal
        try {
            initializeOneSignal();
        } catch (Exception e) {
            Log.e(TAG, "OneSignal initialization failed: " + e.getMessage());
        }
        
        // Handle notification click if app was opened from notification
        try {
            handleNotificationIntent(getIntent());
        } catch (Exception e) {
            Log.e(TAG, "Handle notification intent failed: " + e.getMessage());
        }
    }
    
    private void initializeOneSignal() {
        try {
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
        } catch (Exception e) {
            Log.e(TAG, "OneSignal initialization error: " + e.getMessage());
        }
    }
    
    private void navigateToUrl(String url) {
        try {
            // If bridge is available, use it to load the URL
            if (getBridge() != null && getBridge().getWebView() != null) {
                runOnUiThread(() -> {
                    try {
                        getBridge().getWebView().loadUrl(url);
                    } catch (Exception e) {
                        Log.e(TAG, "WebView loadUrl failed: " + e.getMessage());
                    }
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
        try {
            setIntent(intent);
            handleNotificationIntent(intent);
        } catch (Exception e) {
            Log.e(TAG, "onNewIntent error: " + e.getMessage());
        }
    }
    
    private void handleNotificationIntent(Intent intent) {
        try {
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
        } catch (Exception e) {
            Log.e(TAG, "handleNotificationIntent error: " + e.getMessage());
        }
    }
    
    @Override
    public void onBackPressed() {
        // Close app when back button is pressed
        try {
            finishAffinity();
        } catch (Exception e) {
            Log.e(TAG, "onBackPressed error: " + e.getMessage());
            finish();
        }
    }
}
