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

    // Firebase App Check — защита API от ботов и несанкционированных запросов
    // Site Key подтверждён через reCAPTCHA Admin Console (домены: maxawer1.web.app, mthread.kz)
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider('6Le9ZdksAAAAANd3wMutGE6zPrwaUmLSplo9gMPp'),
            true // автоматическое обновление токена
        );
        console.log('[AppCheck] Firebase App Check activated successfully.');
    } catch (e) {
        console.warn('[AppCheck] Initialization error (non-fatal):', e.message);
    }
}
