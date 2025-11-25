package com.heartlink.dating;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class HeartLinkMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "heartlink_notifications";
    private static final String CHANNEL_NAME = "HeartLink Notifications";
    private static final String CHANNEL_DESCRIPTION = "Notifications for messages, matches, and likes";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Check if message contains a notification payload
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            String type = remoteMessage.getData().get("type");
            
            sendNotification(title, body, type);
        }
    }

    private void sendNotification(String title, String body, String type) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Add data based on notification type
        if (type != null) {
            intent.putExtra("notification_type", type);
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Default notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        // Build notification
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title != null ? title : "HeartLink")
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setVibrate(new long[]{200, 100, 200, 100, 200}) // Vibration pattern
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent);

        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        // Generate unique notification ID
        int notificationId = (int) System.currentTimeMillis();
        
        if (notificationManager != null) {
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                getSystemService(NotificationManager.class);
            
            if (notificationManager != null) {
                NotificationChannel existingChannel = 
                    notificationManager.getNotificationChannel(CHANNEL_ID);
                
                if (existingChannel == null) {
                    // Create notification channel with sound and vibration
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    
                    channel.setDescription(CHANNEL_DESCRIPTION);
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{200, 100, 200, 100, 200});
                    
                    // Set sound
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build();
                    channel.setSound(soundUri, audioAttributes);
                    
                    // Register the channel
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Send token to your backend server
        // This is handled by Capacitor's PushNotifications plugin
    }
}
