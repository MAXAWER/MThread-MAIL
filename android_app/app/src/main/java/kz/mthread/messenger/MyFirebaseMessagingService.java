package kz.mthread.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
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
    private static final String CALL_CHANNEL_ID = "mthread_calls";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed token: " + token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String type = data != null && data.containsKey("type") ? data.get("type") : null;

        // Skip system notification if the app is in the foreground (except for calls)
        if (MainActivity.isAppInForeground && !"call".equals(type)) {
            Log.d(TAG, "App is in foreground and not a call. Skipping system notification.");
            return;
        }

        // Extract message parameters
        String title = null;
        String body = null;
        String chatId = null;
        String isGroup = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        if (data != null && data.size() > 0) {
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

        if ("call".equals(type)) {
            String callerName = data != null ? data.get("callerName") : null;
            
            // Start Ringtone Foreground Service
            Intent ringtoneIntent = new Intent(this, RingtoneService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(ringtoneIntent);
                } else {
                    startService(ringtoneIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to start RingtoneService", e);
            }

            sendCallNotification(
                title != null ? title : "Входящий вызов", 
                body != null ? body : "Вам звонят", 
                chatId,
                callerName != null ? callerName : "Пользователь"
            );
        } else if ("call_cancelled".equals(type)) {
            Log.d(TAG, "Call cancelled/ended/connected. Dismissing notification and stopping ringtone for: " + chatId);
            
            // Stop Ringtone Service
            Intent stopRingtone = new Intent(this, RingtoneService.class);
            stopService(stopRingtone);

            // Broadcast call cancellation to close IncomingCallActivity
            Intent cancelBroadcast = new Intent("kz.mthread.messenger.CALL_CANCELLED");
            sendBroadcast(cancelBroadcast);

            if (chatId != null && !chatId.isEmpty()) {
                int notificationId = chatId.hashCode();
                NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager != null) {
                    notificationManager.cancel(notificationId);
                }
            }
        } else if (title != null || body != null) {
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
        
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags);

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_launcher)
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

            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }

    private void sendCallNotification(String title, String messageBody, String callId, String callerName) {
        if (callId == null || callId.isEmpty()) return;

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Intent for clicking the notification itself / full screen overlay (targets IncomingCallActivity)
        Intent clickIntent = new Intent(this, IncomingCallActivity.class);
        clickIntent.putExtra("callId", callId);
        clickIntent.putExtra("callerName", callerName);
        clickIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent clickPendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), clickIntent, pendingFlags);

        // Intent for the Accept button (targets MainActivity to accept call)
        Intent acceptIntent = new Intent(this, MainActivity.class);
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("action", "accept");
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis() + 1, acceptIntent, pendingFlags);

        // Intent for the Decline button (targets BroadcastReceiver)
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("action", "decline");
        
        int declineFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            declineFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(this, (int) System.currentTimeMillis() + 2, declineIntent, declineFlags);

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setOngoing(true)
                        .setAutoCancel(true)
                        .setSound(ringtoneUri)
                        .setContentIntent(clickPendingIntent)
                        .setFullScreenIntent(clickPendingIntent, true) // Show as full-screen intent / overlay banner
                        .addAction(android.R.drawable.ic_menu_call, "Принять", acceptPendingIntent)
                        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Отклонить", declinePendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CALL_CHANNEL_ID,
                        "Звонки MThread",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Канал для входящих звонков MThread");
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                channel.setSound(ringtoneUri, audioAttributes);
                channel.enableLights(true);
                channel.enableVibration(true);
                notificationManager.createNotificationChannel(channel);
            }

            int notificationId = callId.hashCode();
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }
}
