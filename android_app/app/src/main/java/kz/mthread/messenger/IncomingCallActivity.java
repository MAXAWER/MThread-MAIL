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
import android.os.Build;
import android.os.Bundle;
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

    private final BroadcastReceiver callCancelledReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Call cancelled broadcast received");
            stopRingtoneService();
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
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

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

        // Accept button (green)
        ImageButton acceptButton = new ImageButton(this);
        GradientDrawable acceptBg = new GradientDrawable();
        acceptBg.setShape(GradientDrawable.OVAL);
        acceptBg.setColor(Color.parseColor("#4CAF50"));
        acceptButton.setBackground(acceptBg);
        acceptButton.setImageResource(android.R.drawable.ic_menu_call);
        acceptButton.setColorFilter(Color.WHITE);
        acceptButton.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams acceptParams = new LinearLayout.LayoutParams(buttonSize, buttonSize);
        acceptButton.setLayoutParams(acceptParams);
        acceptButton.setOnClickListener(v -> onAcceptClicked());
        buttonContainer.addView(acceptButton);

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

    private void onAcceptClicked() {
        Log.d(TAG, "Accept clicked. callId=" + callId);

        stopRingtoneService();

        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.putExtra("callId", callId);
        mainIntent.putExtra("action", "accept");
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(mainIntent);

        finish();
    }

    private void onDeclineClicked() {
        Log.d(TAG, "Decline clicked. callId=" + callId);

        stopRingtoneService();

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

    private void stopRingtoneService() {
        try {
            Intent stopIntent = new Intent(this, RingtoneService.class);
            stopService(stopIntent);
            Log.d(TAG, "RingtoneService stop requested");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping RingtoneService", e);
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

        stopRingtoneService();
        super.onDestroy();
    }
}
