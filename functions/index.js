const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document("messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();

    // 1. Get all users to send the notification to
    // In a real app with groups/1-to-1 chats, you'd filter this.
    // Here we send to everyone who has an fcmToken except the sender.
    const usersSnapshot = await admin.firestore().collection("users").get();
    const tokens = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.fcmToken && doc.id !== message.userId) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      console.log("No tokens to send notifications to.");
      return null;
    }

    // 2. Create the notification payload
    const payload = {
      notification: {
        title: `Новое сообщение от ${message.userName}`,
        body: message.text,
      },
    };

    // 3. Send via FCM
    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log("Successfully sent message:", response);
    } catch (error) {
      console.log("Error sending message:", error);
    }

    return null;
  });
