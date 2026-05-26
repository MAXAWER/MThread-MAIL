package kz.mthread.messenger;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class IncomingCallActivity extends AppCompatActivity {

    private static final String TAG = "MThreadIncomingCall";
    private static final String ACTION_CALL_CANCELLED = "kz.mthread.messenger.CALL_CANCELLED";

    private String callId;
    private String callerName;
    private AnimatorSet pulseAnimatorSet;
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;

    private final BroadcastReceiver callCancelledReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Call cancelled broadcast received");
            stopRingtoneAndVibration();
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow display on lock screen and turn screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        // Extract extras
        callId = getIntent().getStringExtra("callId");
        callerName = getIntent().getStringExtra("callerName");
        if (callerName == null || callerName.isEmpty()) {
            callerName = "Неизвестный";
        }

        // Build UI programmatically
        buildUI();

        // Register broadcast receiver for call cancellation
        IntentFilter filter = new IntentFilter(ACTION_CALL_CANCELLED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(callCancelledReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(callCancelledReceiver, filter);
        }

        // Start playing ringtone and vibrating
        startRingtoneAndVibration();
    }

    private void buildUI() {
        int bgColor = Color.parseColor("#0c0e10");

        // Root FrameLayout
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(bgColor);
        rootLayout.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Centered content container
        LinearLayout contentLayout = new LinearLayout(this);
        contentLayout.setOrientation(LinearLayout.VERTICAL);
        contentLayout.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        contentParams.gravity = Gravity.CENTER;
        contentLayout.setLayoutParams(contentParams);

        // --- Pulsating circle + initial container ---
        int avatarSize = dpToPx(120);
        int pulseSize = dpToPx(160);

        FrameLayout avatarContainer = new FrameLayout(this);
        LinearLayout.LayoutParams avatarContainerParams = new LinearLayout.LayoutParams(pulseSize, pulseSize);
        avatarContainerParams.gravity = Gravity.CENTER_HORIZONTAL;
        avatarContainer.setLayoutParams(avatarContainerParams);

        // Pulse circle (behind avatar)
        View pulseCircle = new View(this);
        GradientDrawable pulseDrawable = new GradientDrawable();
        pulseDrawable.setShape(GradientDrawable.OVAL);
        pulseDrawable.setColor(Color.parseColor("#334CAF50"));
        pulseCircle.setBackground(pulseDrawable);
        FrameLayout.LayoutParams pulseParams = new FrameLayout.LayoutParams(pulseSize, pulseSize);
        pulseParams.gravity = Gravity.CENTER;
        pulseCircle.setLayoutParams(pulseParams);
        avatarContainer.addView(pulseCircle);

        // Start pulse animation
        startPulseAnimation(pulseCircle);

        // Avatar circle with initial
        TextView initialView = new TextView(this);
        GradientDrawable avatarDrawable = new GradientDrawable();
        avatarDrawable.setShape(GradientDrawable.OVAL);
        avatarDrawable.setColor(Color.parseColor("#4CAF50"));
        initialView.setBackground(avatarDrawable);
        initialView.setGravity(Gravity.CENTER);
        initialView.setTextColor(Color.WHITE);
        initialView.setTextSize(48);
        initialView.setTypeface(Typeface.DEFAULT_BOLD);
        String initial = callerName.length() > 0 ? callerName.substring(0, 1).toUpperCase() : "?";
        initialView.setText(initial);
        FrameLayout.LayoutParams avatarParams = new FrameLayout.LayoutParams(avatarSize, avatarSize);
        avatarParams.gravity = Gravity.CENTER;
        initialView.setLayoutParams(avatarParams);
        avatarContainer.addView(initialView);

        contentLayout.addView(avatarContainer);

        // --- Caller name ---
        TextView nameView = new TextView(this);
        nameView.setText(callerName);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(24);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        nameParams.topMargin = dpToPx(24);
        nameParams.gravity = Gravity.CENTER_HORIZONTAL;
        nameView.setLayoutParams(nameParams);
        contentLayout.addView(nameView);

        // --- Status text ---
        TextView statusView = new TextView(this);
        statusView.setText("Входящий вызов");
        statusView.setTextColor(Color.parseColor("#B0B0B0"));
        statusView.setTextSize(16);
        statusView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        statusParams.topMargin = dpToPx(8);
        statusParams.gravity = Gravity.CENTER_HORIZONTAL;
        statusView.setLayoutParams(statusParams);
        contentLayout.addView(statusView);

        rootLayout.addView(contentLayout);

        // --- Bottom buttons container ---
        LinearLayout buttonContainer = new LinearLayout(this);
        buttonContainer.setOrientation(LinearLayout.HORIZONTAL);
        buttonContainer.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams buttonContainerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        buttonContainerParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        buttonContainerParams.bottomMargin = dpToPx(80);
        buttonContainer.setLayoutParams(buttonContainerParams);

        int buttonSize = dpToPx(64);

        // Decline button (red)
        ImageButton declineButton = new ImageButton(this);
        GradientDrawable declineBg = new GradientDrawable();
        declineBg.setShape(GradientDrawable.OVAL);
        declineBg.setColor(Color.parseColor("#F44336"));
        declineButton.setBackground(declineBg);
        declineButton.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        declineButton.setColorFilter(Color.WHITE);
        declineButton.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams declineParams = new LinearLayout.LayoutParams(buttonSize, buttonSize);
        declineParams.setMarginEnd(dpToPx(48));
        declineButton.setLayoutParams(declineParams);
        declineButton.setOnClickListener(v -> onDeclineClicked());
        buttonContainer.addView(declineButton);

        // Open App button (blue)
        ImageButton openButton = new ImageButton(this);
        GradientDrawable openBg = new GradientDrawable();
        openBg.setShape(GradientDrawable.OVAL);
        openBg.setColor(Color.parseColor("#2196F3"));
        openButton.setBackground(openBg);
        openButton.setImageResource(android.R.drawable.ic_menu_view);
        openButton.setColorFilter(Color.WHITE);
        openButton.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams openParams = new LinearLayout.LayoutParams(buttonSize, buttonSize);
        openButton.setLayoutParams(openParams);
        openButton.setOnClickListener(v -> onOpenClicked());
        buttonContainer.addView(openButton);

        rootLayout.addView(buttonContainer);

        setContentView(rootLayout);
    }

    private void startPulseAnimation(View pulseView) {
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(pulseView, "scaleX", 1.0f, 1.3f, 1.0f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(pulseView, "scaleY", 1.0f, 1.3f, 1.0f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(pulseView, "alpha", 1.0f, 0.4f, 1.0f);

        pulseAnimatorSet = new AnimatorSet();
        pulseAnimatorSet.playTogether(scaleX, scaleY, alpha);
        pulseAnimatorSet.setDuration(1500);
        pulseAnimatorSet.setInterpolator(new AccelerateDecelerateInterpolator());
        pulseAnimatorSet.setStartDelay(0);

        scaleX.setRepeatCount(ObjectAnimator.INFINITE);
        scaleY.setRepeatCount(ObjectAnimator.INFINITE);
        alpha.setRepeatCount(ObjectAnimator.INFINITE);

        pulseAnimatorSet.start();
    }

    private void onOpenClicked() {
        Log.d(TAG, "Open clicked. callId=" + callId);

        stopRingtoneAndVibration();

        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.putExtra("callId", callId);
        mainIntent.putExtra("action", "open");
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(mainIntent);

        finish();
    }

    private void onDeclineClicked() {
        Log.d(TAG, "Decline clicked. callId=" + callId);

        stopRingtoneAndVibration();

        // Cancel notification
        if (callId != null && !callId.isEmpty()) {
            int notificationId = callId.hashCode();
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(notificationId);
            }

            // Update Firestore call status to "rejected" via REST API
            declineCallInBackground(callId);
        }

        finish();
    }

    private void declineCallInBackground(String callId) {
        SharedPreferences prefs = getSharedPreferences("MThreadPrefs", MODE_PRIVATE);
        String authToken = prefs.getString("authToken", "");
        if (authToken.isEmpty()) {
            Log.e(TAG, "No auth token found, cannot decline call");
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
                Log.e(TAG, "Error declining call", e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }

    private void startRingtoneAndVibration() {
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri == null) {
                ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, ringtoneUri);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_RING);
            }
            mediaPlayer.setLooping(true);
            mediaPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer mp) {
                    try {
                        if (mediaPlayer != null) {
                            mediaPlayer.start();
                            Log.d(TAG, "Ringtone playback started (async)");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error starting media player in onPrepared", e);
                    }
                }
            });
            mediaPlayer.prepareAsync();
        } catch (Exception e) {
            Log.e(TAG, "Error starting ringtone", e);
        }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
                Log.d(TAG, "Vibration started");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting vibration", e);
        }
    }

    private void stopRingtoneAndVibration() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
                Log.d(TAG, "Ringtone stopped and released");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping ringtone", e);
        }

        try {
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
                Log.d(TAG, "Vibration cancelled");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling vibration", e);
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(callCancelledReceiver);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering receiver", e);
        }

        if (pulseAnimatorSet != null) {
            pulseAnimatorSet.cancel();
            pulseAnimatorSet = null;
        }

        stopRingtoneAndVibration();
        super.onDestroy();
    }
}
