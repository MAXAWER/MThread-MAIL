# Руководство по интеграции пуш-уведомлений «как в Telegram» в Android APK для MThread.kz

Для того чтобы уведомления в Android-приложении (APK) приходили мгновенно, надежно и в фоновом режиме (даже когда приложение полностью закрыто и выгружено из оперативной памяти), существует два проверенных профессиональных подхода. Ниже представлены детальные инструкции и готовый код для каждого из них.

---

## Подход №1: Сборка через Trusted Web Activity (TWA) и Bubblewrap (Рекомендуемый)

**Trusted Web Activity (TWA)** — это современный стандарт Google, позволяющий упаковать PWA-сайт (который теперь содержит полноценный `manifest.json`) в нативный APK. 

### Преимущества:
* Уведомления Web Push работают нативно через движок Google Chrome на уровне операционной системы Android.
* 100% надежность фоновой доставки (используются системные службы Google Play Services).
* Не требуется писать сложный нативный код на Java/Kotlin — проект генерируется автоматически на базе Вашего `manifest.json`.

### Пошаговый процесс сборки APK:
1. Установите инструмент Google CLI для сборки PWA в APK:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. Инициализируйте проект Android на основе Вашего веб-манифеста:
   ```bash
   bubblewrap init --manifest=https://maxawer1.web.app/manifest.json
   ```
   *Утилита автоматически загрузит настройки темы, иконки и цвета из `manifest.json` и создаст готовую структуру проекта Android Studio.*
3. Сгенерируйте подписанный релизный APK-файл:
   ```bash
   bubblewrap build
   ```
4. Для подтверждения владения доменом (чтобы убрать адресную строку браузера внутри приложения) настройте файл связей цифровых активов **Digital Asset Links**:
   * Bubblewrap сгенерирует файл `assetlinks.json`.
   * Загрузите этот файл на Ваш хостинг по пути: `https://maxawer1.web.app/.well-known/assetlinks.json`.

---

## Подход №2: Нативная служба FCM в классическом WebView-приложении

Если Вы собираете нативный APK-клиент с использованием `WebView` в Android Studio, операционная система Android будет принудительно завершать фоновые процессы WebView для экономии батареи, из-за чего стандартные веб-уведомления будут пропадать после закрытия приложения.

Чтобы решить эту проблему, необходимо обрабатывать входящие пуш-сообщения на **нативном уровне Android** с помощью Firebase Cloud Messaging SDK.

### Шаг 1: Добавление зависимостей в `app/build.gradle`
Добавьте библиотеку Firebase Messaging в Ваш Android-проект:
```groovy
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### Шаг 2: Реализация нативного фонового сервиса (`MyFirebaseMessagingService.java`)
Создайте в Вашем проекте Java-класс, который будет принимать пуш-сообщения из операционной системы, извлекать данные и отображать системную шторку уведомления со звуком и вибрацией, даже если приложение полностью закрыто:

```java
package kz.mthread.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "mthread_notifications_channel";
    private static final String CHANNEL_NAME = "MThread Messages";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Извлекаем заголовок и тело из секции notification или data
        String title = "Новое сообщение";
        String body = "";

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        } else if (remoteMessage.getData().size() > 0) {
            title = remoteMessage.getData().get("title");
            body = remoteMessage.getData().get("body");
        }

        sendNotification(title, body);
    }

    private void sendNotification(String title, String messageBody) {
        // При клике на уведомление открываем MainActivity
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R_DRAWABLE_ICON_ID_PLACEHOLDER) // Замените на ID Вашей иконки (например, R.drawable.ic_notification)
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setVibrate(new long[]{200, 100, 200})
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Создаем канал уведомлений для Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(0, notificationBuilder.build());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Этот метод вызывается при генерации нативного токена.
        // Вы можете передать его на сервер для отправки уведомлений на конкретное устройство.
    }
}
```

### Шаг 3: Объявление сервиса в `AndroidManifest.xml`
Зарегистрируйте созданную нативную службу внутри тега `<application>`:
```xml
<service
    android:name=".MyFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

### Шаг 4: Связывание нативного токена с веб-кодом в WebView
Чтобы веб-код в Вашем приложении мог сохранить нативный токен устройства в Firestore (так же как это происходит в браузере), настройте Javascript-интерфейс в Вашем `MainActivity.java`:

1. Добавьте Javascript-интерфейс в WebView:
   ```java
   webView.getSettings().setJavaScriptEnabled(true);
   webView.addJavascriptInterface(new WebAppInterface(this), "AndroidApp");
   ```
2. Создайте класс интерфейса для передачи токена:
   ```java
   public class WebAppInterface {
       Context mContext;
       WebAppInterface(Context c) { mContext = c; }

       @android.webkit.JavascriptInterface
       public String getNativeFcmToken() {
           // Получаем токен из Firebase нативно
           final String[] token = new String[1];
           com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
               .addOnCompleteListener(task -> {
                   if (task.isSuccessful()) {
                       token[0] = task.getResult();
                   }
               });
           return token[0];
       }
   }
   ```
3. В Вашем `app.js` добавьте простую интеграцию:
   ```javascript
   // При инициализации проверяем, запущено ли приложение в Android WebView
   if (window.AndroidApp && typeof window.AndroidApp.getNativeFcmToken === 'function') {
       const nativeToken = window.AndroidApp.getNativeFcmToken();
       if (nativeToken) {
           // Записываем нативный токен в Firestore для текущего пользователя
           db.collection('users').doc(currentUser.uid).set({ fcmToken: nativeToken }, { merge: true });
       }
   }
   ```

*Выбрав любой из этих двух подходов, Вы обеспечите высочайшее качество доставки уведомлений в Вашем APK-приложении MThread на уровне современных мессенджеров.*
