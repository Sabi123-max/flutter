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

// ✅ Function to send notification to requester (Hospital or Requester)
const sendNotificationToRequester = async (requesterId, senderId, title, message) => {
  try {
    console.log(`🔍 Searching for requester with requesterId: ${requesterId}`);

    // ✅ Step 1: Validate input parameters
    if (!requesterId || !senderId || !title || !message) {
      throw new Error("Missing required parameters: requesterId, senderId, title, or message");
    }

    console.log(`📌 Sender ID: ${senderId} | Recipient (Requester) ID: ${requesterId}`);

    // ✅ Step 2: Fetch request details from 'blood_requests' collection
    const requestSnapshot = await db
      .collection("blood_requests")
      .where("requesterId", "==", requesterId)
      .get();

    if (requestSnapshot.empty) {
      throw new Error(`Requester with requesterId ${requesterId} not found in 'blood_requests' collection`);
    }

    const requestData = requestSnapshot.docs[0].data();
    console.log(`✅ Found Request Data:`, requestData);

    // ✅ Step 3: Determine User Type (Hospital or Requester) from blood_requests
    const userType = requestData.userType; // Expected values: "hospital" or "requester"
    if (!userType || (userType !== "hospital" && userType !== "requester")) {
      throw new Error(`Invalid userType: ${userType}`);
    }

    console.log(`🔍 Requester Type: ${userType}`);

    // ✅ Step 4: Fetch FCM Token from 'users' collection
    const userSnapshot = await db.collection("users").where("uid", "==", requesterId).get();

    if (userSnapshot.empty) {
      throw new Error(`No user found in 'users' collection for UID: ${requesterId}`);
    }

    const userData = userSnapshot.docs[0].data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new Error(`No FCM token found in 'users' collection for UID: ${requesterId}`);
    }

    console.log(`📢 FCM Token: ${fcmToken}`);

    // ✅ Step 5: Prepare notification payload
    const notification = {
      token: fcmToken,
      notification: {
        title: title || "Blood Donation Response",
        body: message || "A donor is ready to help! Contact them now.",
      },
      data: {
        requesterId: requesterId,
        senderId: senderId,
        userType: userType, // Include userType in the notification data
      }
    };

    // ✅ Step 6: Send the notification
    try {
      await admin.messaging().send(notification);
      console.log("✅ Notification sent successfully!");
    } catch (sendError) {
      console.error("🚨 Error sending notification:", sendError.message);
      throw new Error("Failed to send FCM notification");
    }

    // ✅ Step 7: Store notification in Firestore
    const notificationData = {
      requesterId: requesterId,
      senderId: senderId,
      userType: userType,
      title: title,
      message: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "unread",
    };

    console.log("📂 Storing notification:", notificationData);

    const docRef = await db.collection("notifications").add(notificationData);
    console.log(`✅ Notification stored in Firestore with ID: ${docRef.id}`);

    // ✅ Step 8: Confirm notification storage
    const storedNotification = await docRef.get();
    if (storedNotification.exists) {
      console.log("🔍 Stored Notification Data:", storedNotification.data());
    } else {
      console.log("❌ Notification document not found after storing!");
    }

    // ✅ Successful response
    return { success: true, message: "Notification sent and stored successfully!" };

  } catch (error) {
    console.error("🔥 Error sending notification to requester:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendNotificationToRequester };
