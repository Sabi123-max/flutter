const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { sendNotificationToDonor } = require("./donorNotificationService");
const { sendNotificationToRequester } = require("./requestNotificationService");
const { requestEmergencyBlood } = require("./emergency");
const { saveSettings } = require("./settings");  // Import the saveSettings function

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Prevent Duplicate Firebase Initialization
if (admin.apps.length === 0) {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin Initialized");
} else {
  console.log("⚠ Firebase Admin Already Initialized");
}

const db = admin.firestore(); // Firestore reference
console.log("✅ Firestore connected");

// ✅ Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 📢 ${req.method} request to ${req.url}`);
  console.log("📦 Request body:", req.body);
  next();
});

// ✅ Root Route for Testing Server
app.get("/", (req, res) => {
  res.send("🚀 Blood Bank Notification Server is Running!");
});

app.get("/test-firestore", async (req, res) => {
  try {
    await db.collection("test").add({ message: "Firestore connected!" });
    res.json({ success: true, message: "Firestore write successful!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📌 API to send notifications to donors
app.post("/send-donor-notification", async (req, res) => {
  console.log("📢 Received Notification Request:", req.body); // Debugging

  const { donorId, senderId, title, message } = req.body;

  // ✅ Validate inputs
  if (!donorId || !senderId || !title || !message) {
    console.error("🚨 Missing parameters:", { donorId, senderId, title, message });
    return res.status(400).json({ error: "donorId, senderId, title, and message are required" });
  }

  try {
    console.log(`🔍 Processing notification for Donor ID: ${donorId} from Sender ID: ${senderId}`);

    // ✅ Send the notification
    const response = await sendNotificationToDonor(donorId, senderId, title, message);

    console.log("✅ Notification processing completed:", response);
    return res.json(response);
  } catch (error) {
    console.error("🔥 Error while sending donor notification:", error.message);
    return res.status(500).json({ error: error.message });
  }
});




// 📌 API to send notifications to requesters (FIXED)
app.post("/send-requester-notification", async (req, res) => {
  const { requesterId, senderId, title, message } = req.body; // ✅ Added senderId

  if (!requesterId || !senderId || !title || !message) {  // ✅ Validate senderId
    return res.status(400).json({ error: "requesterId, senderId, title, and message are required" });
  }

  try {
    // ✅ Pass senderId to the function
    const result = await sendNotificationToRequester(requesterId, senderId, title, message);
    console.log("✅ Notification sent to requester:", result);

    res.json({ success: true, message: "Notification sent successfully", result });
  } catch (error) {
    console.error("❌ Error sending requester notification:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message
    });
  }
});

// ✅ API Endpoint to handle emergency requests
app.post("/send-emergency-alert", async (req, res) => {
    console.log("📢 POST request to /send-emergency-alert");
    console.log("📦 Request body:", req.body);

    const { uid, bloodType } = req.body;
    if (!uid || !bloodType) {
        console.log("⚠️ Missing UID or bloodType in request body");
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await requestEmergencyBlood(uid, bloodType); // ✅ Ensure this is being called
        res.status(200).json({ message: "Emergency alert sent successfully!" });
    } catch (error) {
        console.error("❌ Error processing emergency alert:", error);
        res.status(500).json({ error: "Failed to send emergency alert" });
    }
});


// 📌 API to save settings
app.post("/save-settings", async (req, res) => {
  const { userId, locationEnabled, notificationsEnabled, darkModeEnabled } = req.body;

  // Check if required data is provided
  if (!userId || locationEnabled === undefined || notificationsEnabled === undefined || darkModeEnabled === undefined) {
    return res.status(400).json({ success: false, message: "All settings are required" });
  }

  try {
    // Call saveSettings function to save settings to Firestore and external API
    const result = await saveSettings(userId, locationEnabled, notificationsEnabled, darkModeEnabled);
    res.status(200).json(result); // Return the result of the saveSettings function
  } catch (error) {
    console.error("❌ Error saving settings:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
