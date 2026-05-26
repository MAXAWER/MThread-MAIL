const admin = require("firebase-admin");
admin.initializeApp({
  projectId: "maxawer1"
});

async function main() {
  const db = admin.firestore();
  
  console.log("--- Querying mthread_updates_channel ---");
  const doc = await db.collection("groups").doc("mthread_updates_channel").get();
  if (doc.exists) {
    console.log("Channel data:", JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("Channel doc does not exist!");
  }

  console.log("\n--- Querying usernames/maxawer ---");
  const usernameDoc = await db.collection("usernames").doc("maxawer").get();
  if (usernameDoc.exists) {
    console.log("Username maxawer data:", JSON.stringify(usernameDoc.data(), null, 2));
  } else {
    console.log("Username maxawer doc does not exist!");
  }

  console.log("\n--- Querying usernames for all users ---");
  const usersSnap = await db.collection("usernames").get();
  usersSnap.forEach(uDoc => {
    console.log(`Username: ${uDoc.id} => UID: ${uDoc.data().uid}`);
  });
}

main().catch(console.error);
