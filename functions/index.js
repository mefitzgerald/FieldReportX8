const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// Fires when any file is uploaded to Firebase Storage.
// If the file lands in the schemas/ folder, send a push notification
// to every registered device via the Expo push API.
exports.notifyNewTemplate = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  if (!filePath?.startsWith("schemas/")) return;

  const db = getFirestore();
  const snapshot = await db.collection("pushTokens").get();
  const tokens = snapshot.docs
    .map((doc) => doc.data().token)
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log("[notifyNewTemplate] No registered tokens, skipping");
    return;
  }

  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "New Template Available",
      body: "A new report template has been added. Tap to download it.",
    },
    data: { screen: "addtemplates" },
  });

  console.log(`[notifyNewTemplate] Sent push to ${tokens.length} device(s), success: ${response.successCount}, failed: ${response.failureCount}`);
});
