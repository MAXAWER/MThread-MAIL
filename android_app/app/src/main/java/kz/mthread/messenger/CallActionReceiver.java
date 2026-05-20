package kz.mthread.messenger;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "MThreadCallReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getStringExtra("action");
        String callId = intent.getStringExtra("callId");
        Log.d(TAG, "onReceive: action=" + action + ", callId=" + callId);

        if (callId == null || callId.isEmpty()) return;

        // Dismiss the call notification using stable hash code of callId
        int notificationId = callId.hashCode();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(notificationId);
        }

        if ("decline".equals(action)) {
            // Decline call in the background via Firestore REST API with client's saved token
            declineCallInBackground(context, callId);

            // Stop ringtone service
            Intent stopRingtone = new Intent(context, RingtoneService.class);
            context.stopService(stopRingtone);
        }
    }

    private void declineCallInBackground(Context context, String callId) {
        SharedPreferences prefs = context.getSharedPreferences("MThreadPrefs", Context.MODE_PRIVATE);
        String authToken = prefs.getString("authToken", "");
        if (authToken.isEmpty()) {
            Log.e(TAG, "No auth token found, cannot decline call in background");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL("https://firestore.googleapis.com/v1/projects/maxawer1/databases/(default)/documents/calls/" + callId + "?updateMask.fieldPaths=status");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
                conn.setRequestProperty("Authorization", "Bearer " + authToken);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setDoOutput(true);

                String json = "{\"fields\": {\"status\": {\"stringValue\": \"rejected\"}}}";
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = json.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Decline call response code: " + code);
            } catch (Exception e) {
                Log.e(TAG, "Error declining call in background", e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }
}
