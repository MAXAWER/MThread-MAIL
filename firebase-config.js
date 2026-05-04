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
    
    // Включение App Check
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider('6Le9ZdksAAAAANd3wMutGE6zPrwaUmLSplo9gMPp'),
            true // isTokenAutoRefreshEnabled
        );
        console.log("Firebase App Check is active.");
    } catch (e) {
        console.warn("App Check init error:", e);
    }
}
