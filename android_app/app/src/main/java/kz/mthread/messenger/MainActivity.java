package kz.mthread.messenger;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MThreadMainActivity";
    private WebView myWebView;
    private static final int PERMISSION_REQUEST_CODE = 112;
    private String nativeFcmToken = "";

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
                view.loadUrl(url);
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

        // Inject JS Bridge Interface
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");

        // Load our deployed Messenger URL
        myWebView.loadUrl("https://maxawer1.web.app");

        // Pre-fetch Firebase Cloud Messaging Token
        fetchFcmToken();

        // Request Push Notification permission for Android 13+ (API 33+)
        requestNotificationPermission();
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

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                    PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Разрешение на уведомления получено", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Пожалуйста, включите уведомления в настройках системы", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        // Handle physical back button navigating WebView history instead of closing app
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // Javascript Interface class
    public class WebAppInterface {
        @JavascriptInterface
        public String getNativeFcmToken() {
            Log.d(TAG, "getNativeFcmToken interface called. Returning: " + nativeFcmToken);
            return nativeFcmToken;
        }
    }
}
