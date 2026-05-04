// MThread Messenger - Firebase Configuration
// Данные автоматически сгенерированы и привязаны к проекту maxawer1

const firebaseConfig = {
    apiKey: "AIzaSyAOLDRbvcmxKMFwbI3Yf_f02YHQlYtJp6U",
    authDomain: "maxawer1.firebaseapp.com",
    projectId: "maxawer1",
    storageBucket: "maxawer1.firebasestorage.app",
    messagingSenderId: "681371275509",
    appId: "1:681371275509:web:7c5469f5bac03e10da75bc"
};

// Инициализация
if (firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);

    // App Check — активировать после получения реального Site Key из Firebase Console -> App Check
    // Шаги: Firebase Console -> App Check -> Зарегистрировать веб-приложение -> выбрать reCAPTCHA v3
    // -> получить Site Key -> вставить ниже и раскомментировать.
    //
    // try {
    //     const appCheck = firebase.appCheck();
    //     appCheck.activate(
    //         new firebase.appCheck.ReCaptchaV3Provider('ВСТАВЬТЕ_СЮДА_РЕАЛЬНЫЙ_SITE_KEY'),
    //         true
    //     );
    //     console.log("Firebase App Check is active.");
    // } catch (e) {
    //     console.warn("App Check init error:", e);
    // }
}
