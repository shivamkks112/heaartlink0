package com.heartlink.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;

public class MainActivity extends BridgeActivity {
    
    private static final String ONESIGNAL_APP_ID = "ad0b57dc-908b-4d84-8654-d6b5dd50684e";
    private static final String TAG = "HeartLink";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            // Initialize AdMob
            MobileAds.initialize(this, initializationStatus -> {
                Log.d(TAG, "AdMob initialized");
            });
        } catch (Exception e) {
            Log.e(TAG, "AdMob init error: " + e.getMessage());
        }
        
        try {
            // Initialize OneSignal
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
            OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
            OneSignal.getNotifications().requestPermission(true, null);
            Log.d(TAG, "OneSignal initialized");
        } catch (Exception e) {
            Log.e(TAG, "OneSignal init error: " + e.getMessage());
        }
        
        Log.d(TAG, "HeartLink started successfully");
    }
    
    @Override
    public void onBackPressed() {
        finishAffinity();
    }
}
