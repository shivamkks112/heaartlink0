package com.heartlink.app;

import android.app.Notification;
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

import java.util.Map;

/**
 * Custom FCM service.
 *
 * IMPORTANT: This only handles the case where the app is in the FOREGROUND
 * OR the FCM payload is data-only. When app is in background and the payload
 * contains a "notification" block, Android system displays the notification
 * itself using the channel referenced by
 *   com.google.firebase.messaging.default_notification_channel_id
 * in AndroidManifest.xml. That channel is created in MainActivity.onCreate().
 *
 * We use the SAME channel id ("heartlink_high_v2") here for consistency so
 * that every notification lands in the high-importance channel that enables
 * the Android heads-up popup banner.
 *
 * NOTIFICATION GROUPING:
 * Different notification types are grouped so the notification tray shows a
 * clean stack per category rather than a flat list. The heads-up popup for
 * the LATEST notification still appears — grouping only affects the tray.
 */
public class HeartLinkMessagingService extends FirebaseMessagingService {

    // Must match:
    //   - AndroidManifest.xml default_notification_channel_id
    //   - MainActivity.createNotificationChannel()
    //   - Backend firebase_config.py AndroidNotification.channel_id
    //   - Backend onesignal_config.py android_channel_id
    private static final String CHANNEL_ID = "heartlink_high_v2";

    // Notification groups (per type). Groups only affect tray layout, not popup.
    private static final String GROUP_MESSAGES = "com.heartlink.group.messages";
    private static final String GROUP_LIKES = "com.heartlink.group.likes";
    private static final String GROUP_MATCHES = "com.heartlink.group.matches";
    private static final String GROUP_PROFILE_VIEWS = "com.heartlink.group.profile_views";
    private static final String GROUP_ADMIN = "com.heartlink.group.admin";
    private static final String GROUP_SYSTEM = "com.heartlink.group.system"; // verification, premium

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        String title = null;
        String body = null;
        String type = null;
        Integer badge = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        Map<String, String> data = remoteMessage.getData();
        if (data != null) {
            type = data.get("type");
            if (title == null) title = data.get("title");
            if (body == null) body = data.get("body");
            String badgeStr = data.get("badge_count");
            if (badgeStr != null) {
                try { badge = Integer.parseInt(badgeStr); } catch (NumberFormatException ignored) {}
            }
        }

        if (title != null || body != null) {
            sendNotification(title, body, type, badge);
        }
    }

    private void sendNotification(String title, String body, String type, Integer badge) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (type != null) intent.putExtra("notification_type", type);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) System.currentTimeMillis(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        String group = groupFor(type);
        int categoryPriority = "message".equals(type)
            ? NotificationCompat.CATEGORY_MESSAGE.hashCode()
            : NotificationCompat.CATEGORY_SOCIAL.hashCode();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title != null ? title : "HeartLink")
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setSound(sound)
            .setVibrate(new long[]{0, 300, 200, 300})
            // PRIORITY_MAX + defaults ensure heads-up popup on Android < 8.
            // On Android 8+ heads-up is controlled by channel importance.
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setCategory("message".equals(type) ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_SOCIAL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setGroup(group)
            .setContentIntent(pendingIntent);

        if (badge != null && badge > 0) {
            builder.setNumber(badge);
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) System.currentTimeMillis(), builder.build());
        }
    }

    private static String groupFor(String type) {
        if (type == null) return GROUP_SYSTEM;
        switch (type) {
            case "message":
            case "new_message":
                return GROUP_MESSAGES;
            case "like":
            case "new_like":
                return GROUP_LIKES;
            case "match":
            case "new_match":
                return GROUP_MATCHES;
            case "profile_view":
                return GROUP_PROFILE_VIEWS;
            case "admin":
            case "promotional":
                return GROUP_ADMIN;
            case "verification":
            case "premium":
            default:
                return GROUP_SYSTEM;
        }
    }

    /**
     * Idempotent channel creation. Called from onCreate() so the channel is
     * guaranteed to exist by the time we build a notification. Also created
     * from MainActivity.onCreate() so it exists on fresh install before any
     * FCM message arrives.
     *
     * NOTE: On Android 8+ (Oreo+), heads-up popup behaviour is decided by the
     * NotificationChannel's IMPORTANCE_HIGH + sound URI. PRIORITY_HIGH on the
     * builder is ignored on API 26+.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            if (manager.getNotificationChannel(CHANNEL_ID) != null) return;

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "HeartLink Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Matches, Likes, Messages, Profile Views, Admin");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.enableLights(true);
            channel.setLightColor(0xFFFF6B9D);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(sound, audioAttrs);

            manager.createNotificationChannel(channel);
        }
    }
}
