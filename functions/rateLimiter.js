/**
 * Rate Limiter for Firebase Cloud Functions
 * Uses Firestore to track request counts per user per time window.
 * This is a server-side protection layer against API abuse and brute-force.
 */

const admin = require("firebase-admin");

/**
 * Check if a user has exceeded their rate limit.
 * @param {string} uid - The user ID
 * @param {string} action - The action being rate-limited (e.g., 'createGroup')
 * @param {number} maxCalls - Maximum allowed calls in the window
 * @param {number} windowSeconds - Window size in seconds
 * @throws {functions.https.HttpsError} if rate limit exceeded
 */
async function checkRateLimit(uid, action, maxCalls = 10, windowSeconds = 60) {
    const db = admin.firestore();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const ref = db
        .collection("_rateLimits")
        .doc(`${uid}_${action}`);

    const LIMIT_EXCEEDED_ERROR = new (require("firebase-functions").https.HttpsError)(
        "resource-exhausted",
        `Too many requests. Please wait ${windowSeconds} seconds before trying again.`
    );

    await db.runTransaction(async (t) => {
        const doc = await t.get(ref);

        if (!doc.exists) {
            // First request — create record
            t.set(ref, {
                count: 1,
                windowStart: now,
                updatedAt: now,
            });
            return;
        }

        const data = doc.data();

        if (data.windowStart < windowStart) {
            // Window has expired — reset counter
            t.update(ref, {
                count: 1,
                windowStart: now,
                updatedAt: now,
            });
            return;
        }

        // Within the window — increment and check
        if (data.count >= maxCalls) {
            throw LIMIT_EXCEEDED_ERROR;
        }

        t.update(ref, {
            count: admin.firestore.FieldValue.increment(1),
            updatedAt: now,
        });
    });
}

module.exports = { checkRateLimit };
