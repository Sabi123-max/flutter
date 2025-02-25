const admin = require("firebase-admin");

// ✅ Initialize Firebase only if it's not already initialized
if (admin.apps.length === 0) {
  try {
    const serviceAccount = require("./serviceAccountKey.json"); // Ensure this file exists!
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin Initialized");
  } catch (error) {
    console.error("🔥 Firebase Initialization Error:", error.message);
    process.exit(1);
  }
}

const db = admin.firestore(); // Firestore reference

// ✅ Function to send notification to donor
const sendNotificationToDonor = async (donorId, senderId, title, message) => {
  try {
    console.log(`🔍 Searching for donor with donorId: ${donorId}`);

    // ✅ Step 1: Validate input parameters
    if (!donorId || !senderId || !title || !message) {
      throw new Error("Missing required parameters: donorId, senderId, title, or message");
    }

    console.log(`📌 Sender ID: ${senderId} | Recipient (Donor) ID: ${donorId}`);

    // ✅ Step 2: Fetch donor from 'donors' collection using donorId
    const donorSnapshot = await db.collection("donors").where("donorId", "==", donorId).get();

    if (donorSnapshot.empty) {
      throw new Error(`Donor with donorId ${donorId} not found in 'donors' collection`);
    }

    const donorData = donorSnapshot.docs[0].data();
    console.log(`✅ Found Donor Data:`, donorData);

    // ✅ Step 3: Fetch donor's user details from 'users' collection using donorId (as UID)
    const userSnapshot = await db.collection("users").where("uid", "==", donorId).get();

    if (userSnapshot.empty) {
      throw new Error(`No user found in 'users' collection for UID: ${donorId}`);
    }

    const userData = userSnapshot.docs[0].data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new Error(`No FCM token found in 'users' collection for UID: ${donorId}`);
    }

    console.log(`📢 FCM Token: ${fcmToken}`);

    // ✅ Step 4: Prepare notification payload
    const notification = {
      token: fcmToken,
      notification: {
        title: title || "Blood Donation Request",
        body: message || "A patient needs blood urgently. Can you donate?",
      },
      data: {
        donorId: donorId,
        senderId: senderId,
      }
    };

    // ✅ Step 5: Send the notification
    try {
      await admin.messaging().send(notification);
      console.log("✅ Notification sent successfully!");
    } catch (sendError) {
      console.error("🚨 Error sending notification:", sendError.message);
      throw new Error("Failed to send FCM notification");
    }

    // ✅ Step 6: Store notification in Firestore
    const notificationData = {
      donorId: donorId,
      senderId: senderId,
      title: title,
      message: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "unread",
    };

    console.log("📂 Storing notification:", notificationData);

    const docRef = await db.collection("notifications").add(notificationData);
    console.log(`✅ Notification stored in Firestore with ID: ${docRef.id}`);

    // ✅ Step 7: Confirm notification storage
    const storedNotification = await docRef.get();
    if (storedNotification.exists) {
      console.log("🔍 Stored Notification Data:", storedNotification.data());
    } else {
      console.log("❌ Notification document not found after storing!");
    }

    // ✅ Successful response
    return { success: true, message: "Notification sent and stored successfully!" };

  } catch (error) {
    console.error("🔥 Error sending notification to donor:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendNotificationToDonor };
