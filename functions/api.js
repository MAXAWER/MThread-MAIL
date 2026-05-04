const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { checkRateLimit } = require("./rateLimiter");

// Middleware-like check
function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to perform this action."
        );
    }
}

exports.createGroup = functions.https.onCall(async (data, context) => {
    requireAuth(context);
    await checkRateLimit(context.auth.uid, 'createGroup', 5, 60); // Max 5 groups per minute
    
    const { name, participants } = data;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Group name is required.");
    }
    if (!Array.isArray(participants)) {
        throw new functions.https.HttpsError("invalid-argument", "Participants must be an array.");
    }

    const uid = context.auth.uid;
    const finalParticipants = [...new Set([uid, ...participants])];

    if (finalParticipants.length > 50) {
        throw new functions.https.HttpsError("invalid-argument", "Too many participants.");
    }

    const groupData = {
        name: name.trim(),
        participants: finalParticipants,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: '',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        isGroup: true
    };

    const docRef = await admin.firestore().collection("groups").add(groupData);
    
    return { groupId: docRef.id };
});

exports.updateGroupMetadata = functions.https.onCall(async (data, context) => {
    requireAuth(context);
    await checkRateLimit(context.auth.uid, 'updateGroup', 20, 60); // Max 20 updates per minute
    
    const { groupId, name } = data;
    if (!groupId || !name || typeof name !== 'string' || name.trim().length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid group ID or name.");
    }

    const uid = context.auth.uid;
    const groupRef = admin.firestore().collection("groups").doc(groupId);
    
    const doc = await groupRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    
    const group = doc.data();
    if (group.createdBy !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Only the group creator can update metadata.");
    }

    await groupRef.update({
        name: name.trim()
    });

    return { success: true };
});

exports.manageGroupMembers = functions.https.onCall(async (data, context) => {
    requireAuth(context);
    await checkRateLimit(context.auth.uid, 'manageMembers', 30, 60); // Max 30 member ops per minute
    
    const { groupId, action, targetUid } = data;
    if (!groupId || !targetUid || !['add', 'remove'].includes(action)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid parameters.");
    }

    const uid = context.auth.uid;
    const groupRef = admin.firestore().collection("groups").doc(groupId);
    
    const doc = await groupRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    
    const group = doc.data();
    if (group.createdBy !== uid && uid !== targetUid) {
        // Only creator can add/remove others. Users can remove themselves.
        throw new functions.https.HttpsError("permission-denied", "You don't have permission to modify members.");
    }

    if (action === 'add') {
        if (group.participants.length >= 50) {
            throw new functions.https.HttpsError("resource-exhausted", "Group is full.");
        }
        await groupRef.update({
            participants: admin.firestore.FieldValue.arrayUnion(targetUid)
        });
    } else if (action === 'remove') {
        if (targetUid === group.createdBy) {
            throw new functions.https.HttpsError("failed-precondition", "Creator cannot leave the group.");
        }
        await groupRef.update({
            participants: admin.firestore.FieldValue.arrayRemove(targetUid)
        });
    }

    return { success: true };
});

exports.deleteGroup = functions.https.onCall(async (data, context) => {
    requireAuth(context);
    await checkRateLimit(context.auth.uid, 'deleteGroup', 3, 60); // Max 3 deletions per minute
    
    const { groupId } = data;
    if (!groupId) {
        throw new functions.https.HttpsError("invalid-argument", "Group ID is required.");
    }

    const uid = context.auth.uid;
    const groupRef = admin.firestore().collection("groups").doc(groupId);
    
    const doc = await groupRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    
    const group = doc.data();
    if (group.createdBy !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Only the group creator can delete the group.");
    }

    // Delete messages subcollection first
    const messages = await groupRef.collection('messages').listDocuments();
    if (messages.length > 0) {
        const batch = admin.firestore().batch();
        messages.forEach(doc => batch.delete(doc));
        await batch.commit();
    }

    // Delete the group document
    await groupRef.delete();

    return { success: true };
});
