const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const api = require('./api');
exports.createGroup = api.createGroup;
exports.updateGroupMetadata = api.updateGroupMetadata;
exports.manageGroupMembers = api.manageGroupMembers;
exports.deleteGroup = api.deleteGroup;

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

      // 4. Create the notification payload (Use both notification and data for cross-platform OS-level delivery)
      const messagePayload = {
        token: fcmToken,
        notification: {
          title: `Новое сообщение от ${message.userName}`,
          body: message.text,
        },
        data: {
          title: `Новое сообщение от ${message.userName}`,
          body: message.text,
          chatId: chatId,
          click_action: 'https://maxawer1.web.app'
        },
        webpush: {
          notification: {
            icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d'
          },
          fcmOptions: {
            link: 'https://maxawer1.web.app'
          }
        }
      };

      // 5. Send via FCM HTTP v1
      const response = await admin.messaging().send(messagePayload);
      console.log("Successfully sent message via FCM v1:", response);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    return null;
  });

exports.cleanupChatStorage = functions.firestore
  .document("{collection}/{chatId}")
  .onDelete(async (snap, context) => {
    const { collection, chatId } = context.params;
    
    // Only proceed for chats and groups
    if (collection !== 'chats' && collection !== 'groups') {
      return null;
    }

    try {
      const bucket = admin.storage().bucket();
      // Delete all files in the chat's folder
      await bucket.deleteFiles({
        prefix: `chat_images/${chatId}/`
      });
      console.log(`Successfully deleted storage files for ${collection}/${chatId}`);
    } catch (error) {
      console.error(`Error deleting storage files for ${collection}/${chatId}:`, error);
    }
    return null;
  });

exports.cleanupUserAccount = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const bucket = admin.storage().bucket();
  const db = admin.firestore();

  try {
    // 1. Get username before deleting user doc
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      const username = userDoc.data().username;
      
      // 2. Delete username mapping
      if (username) {
        await db.collection('usernames').doc(username).delete();
      }
      
      // 3. Delete user profile doc
      await userDocRef.delete();
    }

    // 4. Remove user from all groups (arrayRemove from participants)
    const groupsSnapshot = await db.collection('groups')
      .where('participants', 'array-contains', uid)
      .get();
    
    const groupBatch = db.batch();
    groupsSnapshot.forEach(doc => {
      const group = doc.data();
      if (group.createdBy === uid) {
        // Creator deleted — delete the whole group
        groupBatch.delete(doc.ref);
      } else {
        // Non-creator — just remove from participants
        groupBatch.update(doc.ref, {
          participants: admin.firestore.FieldValue.arrayRemove(uid)
        });
      }
    });
    await groupBatch.commit();

    // 5. Remove user from all DM chats
    const chatsSnapshot = await db.collection('chats')
      .where('participants', 'array-contains', uid)
      .get();
    
    const chatBatch = db.batch();
    chatsSnapshot.forEach(doc => {
      chatBatch.delete(doc.ref);
    });
    await chatBatch.commit();

    // 6. Delete avatars from storage
    const [files] = await bucket.getFiles({ prefix: `avatars/${uid}_` });
    const deletePromises = files.map(file => file.delete());
    await Promise.all(deletePromises);
    
    console.log(`Successfully cleaned up data for deleted user ${uid}`);
  } catch (error) {
    console.error(`Error cleaning up user data for ${uid}:`, error);
  }
  return null;
});

exports.sendGroupPushNotification = functions.firestore
  .document("groups/{groupId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const groupId = context.params.groupId;

    try {
      // 1. Get the group document to find participants
      const groupDoc = await admin.firestore().collection("groups").doc(groupId).get();
      if (!groupDoc.exists) return null;

      const groupData = groupDoc.data();
      const participants = groupData.participants || [];

      // 2. Filter out the sender
      const receivers = participants.filter(id => id !== message.userId);
      if (receivers.length === 0) return null;

      // 3. For each receiver, get their FCM token
      const tokensPromises = receivers.map(async (receiverId) => {
        const userDoc = await admin.firestore().collection("users").doc(receiverId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return userData.fcmToken || null;
        }
        return null;
      });

      const fcmTokens = (await Promise.all(tokensPromises)).filter(token => token !== null);
      if (fcmTokens.length === 0) {
        console.log("No FCM tokens found for group participants:", groupId);
        return null;
      }

      // 4. Send notifications via FCM v1 to each token
      const sendPromises = fcmTokens.map(async (fcmToken) => {
        const messagePayload = {
          token: fcmToken,
          notification: {
            title: `${groupData.name}: сообщение от ${message.userName}`,
            body: message.text,
          },
          data: {
            title: `${groupData.name}: сообщение от ${message.userName}`,
            body: message.text,
            chatId: groupId,
            isGroup: "true",
            click_action: 'https://maxawer1.web.app'
          },
          webpush: {
            notification: {
              icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d'
            },
            fcmOptions: {
              link: 'https://maxawer1.web.app'
            }
          }
        };
        try {
          const response = await admin.messaging().send(messagePayload);
          console.log("Successfully sent group message via FCM v1 to token:", response);
        } catch (err) {
          console.error("Error sending group message to token:", err);
        }
      });

      await Promise.all(sendPromises);
    } catch (error) {
      console.error("Error sending group push notifications:", error);
    }

    return null;
  });
