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
import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MThreadMainActivity";
    public static boolean isAppInForeground = false;
    private WebView myWebView;
    private static final int PERMISSION_REQUEST_CODE = 112;
    private String nativeFcmToken = "";
    private ValueCallback<Uri[]> uploadMessage;
    private final static int FILECHOOSER_RESULTCODE = 1;

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
        webSettings.setMediaPlaybackRequiresUserGesture(false);

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

        // Grant WebRTC microphone/camera permissions and handle file selection to the WebView
        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (ActivityNotFoundException e) {
                    uploadMessage = null;
                    Toast.makeText(MainActivity.this, "Не удалось открыть выбор файлов", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Inject JS Bridge Interface
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");

        // Support downloads inside the WebView using system DownloadManager
        myWebView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                    request.addRequestHeader("cookie", cookies);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("Скачивание файла...");
                    String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(filename);
                    request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, filename);
                    
                    android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "Скачивание файла началось", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error downloading file", e);
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ex) {
                        Log.e(TAG, "Error opening download URL in browser", ex);
                        Toast.makeText(MainActivity.this, "Не удалось скачать файл", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });

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
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            list.add(Manifest.permission.CAMERA);
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        ClipData.Item item = clipData.getItemAt(i);
                        results[i] = item.getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
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
    protected void onStart() {
        super.onStart();
        isAppInForeground = true;
    }

    @Override
    protected void onStop() {
        super.onStop();
        isAppInForeground = false;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        isAppInForeground = false;
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
                Intent serviceIntent = new Intent(MainActivity.this, CallForegroundService.class);
                if (active) {
                    registerProximityListener();
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(serviceIntent);
                        } else {
                            startService(serviceIntent);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error starting foreground service", e);
                    }
                    try {
                        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                        if (audioManager != null) {
                            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                            audioManager.setSpeakerphoneOn(false);
                            Log.d(TAG, "Audio mode initialized to MODE_IN_COMMUNICATION and speakerphone off");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error initializing call audio mode", e);
                    }
                } else {
                    unregisterProximityListener();
                    try {
                        stopService(serviceIntent);
                    } catch (Exception e) {
                        Log.e(TAG, "Error stopping foreground service", e);
                    }
                    // Hard reset audio routing when call is terminated
                    try {
                        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                        if (audioManager != null) {
                            audioManager.setSpeakerphoneOn(false);
                            audioManager.setMode(AudioManager.MODE_NORMAL);
                            Log.d(TAG, "Audio mode forced to MODE_NORMAL on call completion");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error resetting audio mode on call completion", e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void setSpeakerphoneOn(final boolean on) {
            runOnUiThread(() -> {
                try {
                    AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                    if (audioManager != null) {
                        // Ensure we remain in MODE_IN_COMMUNICATION during VoIP calls!
                        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                        audioManager.setSpeakerphoneOn(on);
                        Log.d(TAG, "Speakerphone set to: " + on + ", Mode: MODE_IN_COMMUNICATION");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error setting speakerphone", e);
                }
            });
        }
    }
}
