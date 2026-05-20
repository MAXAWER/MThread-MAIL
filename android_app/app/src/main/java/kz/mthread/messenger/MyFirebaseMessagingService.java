package kz.mthread.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MThreadFCMService";
    private static final String CHANNEL_ID = "mthread_notifications";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed token: " + token);
        // Token will be sent to the server dynamically from MainActivity upon launch or refresh
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Skip system notification if the app is in the foreground
        if (MainActivity.isAppInForeground) {
            Log.d(TAG, "App is in foreground. Skipping system notification.");
            return;
        }

        // Extract message title and body
        String title = null;
        String body = null;
        String chatId = null;
        String isGroup = null;

        // Check if message contains a notification payload
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // Check if message contains a data payload (allows advanced payload customization)
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            if (title == null && data.containsKey("title")) {
                title = data.get("title");
            }
            if (body == null && data.containsKey("body")) {
                body = data.get("body");
            }
            if (data.containsKey("chatId")) {
                chatId = data.get("chatId");
            }
            if (data.containsKey("isGroup")) {
                isGroup = data.get("isGroup");
            }
        }

        if (title != null || body != null) {
            sendNotification(
                title != null ? title : "MThread", 
                body != null ? body : "", 
                chatId, 
                isGroup
            );
        }
    }

    private void sendNotification(String title, String messageBody, String chatId, String isGroup) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (chatId != null) {
            intent.putExtra("chatId", chatId);
        }
        if (isGroup != null) {
            intent.putExtra("isGroup", isGroup);
        }
        
        // PendingIntent flags for modern Android compatibility (Android 12+ requires FLAG_IMMUTABLE/MUTABLE)
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags);

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_launcher) // Use custom launcher icon
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setContentIntent(pendingIntent)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setDefaults(NotificationCompat.DEFAULT_ALL);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager != null) {
            // Since Android Oreo (8.0+), a notification channel is required for high priority notifications
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Сообщения MThread",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Канал для уведомлений о новых сообщениях");
                channel.enableLights(true);
                channel.enableVibration(true);
                notificationManager.createNotificationChannel(channel);
            }

            // Using system timestamp as ID to prevent notification overriding
            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }
}
