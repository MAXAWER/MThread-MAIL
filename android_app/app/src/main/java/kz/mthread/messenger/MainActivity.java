package kz.mthread.messenger;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import androidx.activity.OnBackPressedCallback;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.PowerManager;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MThreadMainActivity";
    private WebView myWebView;
    private static final int PERMISSION_REQUEST_CODE = 112;
    private String nativeFcmToken = "";

    private SensorManager sensorManager;
    private Sensor proximitySensor;
    private PowerManager.WakeLock proximityWakeLock;
    private boolean isCallActive = false;
    private SensorEventListener proximitySensorListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Dynamic WebView setup programmatically to avoid dependency on layout XML files
        myWebView = new WebView(this);
        setContentView(myWebView);

        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true); // Mandatory for Firebase state and storage persistence
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Keep navigation inside WebView
        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("https://mthread.kz") || url.startsWith("https://maxawer1.web.app") || url.startsWith("http://mthread.kz")) {
                    return false; // Load inside WebView
                }
                // Open external links in external system browser
                try {
                    android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "Error opening external URL", e);
                }
                return true;
            }
            
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Push token if it is already fetched when the page finishes loading
                if (nativeFcmToken != null && !nativeFcmToken.isEmpty()) {
                    myWebView.evaluateJavascript(
                        "if (typeof onNativeFcmTokenReceived === 'function') { onNativeFcmTokenReceived('" + nativeFcmToken + "'); }", 
                        null
                    );
                }
            }
        });

        // Grant WebRTC microphone/camera permissions to the WebView
        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        // Inject JS Bridge Interface
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");

        // Load our deployed Messenger URL
        myWebView.loadUrl("https://mthread.kz");

        // Pre-fetch Firebase Cloud Messaging Token
        fetchFcmToken();

        // Request required runtime permissions (Microphone, Notifications)
        requestAppPermissions();

        // Handle initial notification intent if app was closed
        handleNotificationIntent(getIntent());

        // Handle back press using modern OnBackPressedDispatcher
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (myWebView != null) {
                    myWebView.evaluateJavascript("window.handleAndroidBackGesture ? window.handleAndroidBackGesture() : false", value -> {
                        Log.d(TAG, "Back gesture handler returned: " + value);
                        if ("true".equals(value) || "\"true\"".equals(value)) {
                            Log.d(TAG, "Back gesture was handled by WebView JS.");
                        } else {
                            runOnUiThread(() -> {
                                // Always minimize the app if the back gesture is not consumed by Web UI,
                                // since MThread is a Single Page Application.
                                moveTaskToBack(true);
                            });
                        }
                    });
                } else {
                    setEnabled(false);
                    MainActivity.super.onBackPressed();
                    setEnabled(true);
                }
            }
        });

        // Initialize Proximity Sensor and WakeLock for calling
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            proximitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        }

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                if (powerManager.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
                    proximityWakeLock = powerManager.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "MThread:ProximityWakeLock");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error creating proximity wake lock", e);
            }
        }

        proximitySensorListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (event.sensor.getType() == Sensor.TYPE_PROXIMITY) {
                    boolean isNear = event.values[0] < event.sensor.getMaximumRange();
                    Log.d(TAG, "Proximity sensor: isNear=" + isNear);
                    if (isNear) {
                        if (proximityWakeLock != null && !proximityWakeLock.isHeld()) {
                            proximityWakeLock.acquire();
                        }
                        sendProximityToJs(true);
                    } else {
                        if (proximityWakeLock != null && proximityWakeLock.isHeld()) {
                            proximityWakeLock.release();
                        }
                        sendProximityToJs(false);
                    }
                }
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(android.content.Intent intent) {
        if (intent != null && intent.hasExtra("chatId")) {
            String chatId = intent.getStringExtra("chatId");
            String isGroup = intent.getStringExtra("isGroup");
            Log.d(TAG, "Notification Intent received. chatId: " + chatId + ", isGroup: " + isGroup);
            if (chatId != null && !chatId.isEmpty()) {
                runOnUiThread(() -> {
                    if (myWebView != null) {
                        myWebView.evaluateJavascript(
                            "if (typeof openChatFromNotification === 'function') { openChatFromNotification('" + chatId + "', '" + isGroup + "'); } else { window.pendingNotificationChat = { chatId: '" + chatId + "', isGroup: '" + isGroup + "' }; }",
                            null
                        );
                    }
                });
            }
        }
    }

    private void fetchFcmToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) {
                    nativeFcmToken = task.getResult();
                    Log.d(TAG, "Fetched native FCM token: " + nativeFcmToken);
                    // Push token asynchronously to the frontend as soon as it is fetched
                    runOnUiThread(() -> {
                        if (myWebView != null) {
                            myWebView.evaluateJavascript(
                                "if (typeof onNativeFcmTokenReceived === 'function') { onNativeFcmTokenReceived('" + nativeFcmToken + "'); }", 
                                null
                            );
                        }
                    });
                } else {
                    Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                }
            });
    }

    private void requestAppPermissions() {
        java.util.ArrayList<String> list = new java.util.ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            list.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                list.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (!list.isEmpty()) {
            ActivityCompat.requestPermissions(this, list.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean micGranted = false;
            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.RECORD_AUDIO) && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    micGranted = true;
                }
            }
            if (micGranted) {
                Toast.makeText(this, "Доступ к микрофону разрешен", Toast.LENGTH_SHORT).show();
            }
        }
    }

    // Legacy onBackPressed overridden callback removed in favor of OnBackPressedDispatcher registered in onCreate

    private void sendProximityToJs(final boolean isNear) {
        runOnUiThread(() -> {
            if (myWebView != null) {
                myWebView.evaluateJavascript("if (typeof window.onProximityChanged === 'function') { window.onProximityChanged(" + isNear + "); }", null);
            }
        });
    }

    private void registerProximityListener() {
        if (sensorManager != null && proximitySensor != null) {
            sensorManager.registerListener(proximitySensorListener, proximitySensor, SensorManager.SENSOR_DELAY_NORMAL);
            Log.d(TAG, "Proximity listener registered");
        }
    }

    private void unregisterProximityListener() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(proximitySensorListener);
            Log.d(TAG, "Proximity listener unregistered");
        }
        if (proximityWakeLock != null && proximityWakeLock.isHeld()) {
            try {
                proximityWakeLock.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing wake lock", e);
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterProximityListener();
    }

    // Javascript Interface class
    public class WebAppInterface {
        @JavascriptInterface
        public String getNativeFcmToken() {
            Log.d(TAG, "getNativeFcmToken interface called. Returning: " + nativeFcmToken);
            return nativeFcmToken;
        }

        @JavascriptInterface
        public void setCallActive(final boolean active) {
            runOnUiThread(() -> {
                isCallActive = active;
                Log.d(TAG, "setCallActive interface called: " + active);
                if (active) {
                    registerProximityListener();
                } else {
                    unregisterProximityListener();
                }
            });
        }

        @JavascriptInterface
        public void setSpeakerphoneOn(final boolean on) {
            runOnUiThread(() -> {
                try {
                    AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                    if (audioManager != null) {
                        if (on) {
                            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                            audioManager.setSpeakerphoneOn(true);
                        } else {
                            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                            audioManager.setSpeakerphoneOn(false);
                        }
                        Log.d(TAG, "Speakerphone set to: " + on);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error setting speakerphone", e);
                }
            });
        }
    }
}
