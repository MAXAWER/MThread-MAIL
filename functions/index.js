const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;

    try {
      // 1. Get the chat document to find participants
      const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
      if (!chatDoc.exists) return null;

      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      // 2. Find the receiver (the user who is not the sender)
      const receiverId = participants.find(id => id !== message.userId);
      if (!receiverId) return null;

      // 3. Get the receiver's FCM token
      const userDoc = await admin.firestore().collection("users").doc(receiverId).get();
      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken) {
        console.log("No FCM token found for user:", receiverId);
        return null;
      }

      // 4. Create the notification payload
      const payload = {
        notification: {
          title: `Новое сообщение от ${message.userName}`,
          body: message.text,
        },
      };

      // 5. Send via FCM
      const response = await admin.messaging().sendToDevice(fcmToken, payload);
      console.log("Successfully sent message:", response);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    return null;
  });
