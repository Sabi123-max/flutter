const admin = require("firebase-admin");
const haversine = require("haversine-distance");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function requestEmergencyBlood(requesterUid, bloodType) {
    try {
        console.log("📢 Emergency request initiated...");
        console.log(`🩸 Blood Type Requested: ${bloodType}`);
        console.log(`🔍 Searching for requester's donor entry (UID: ${requesterUid})...`);

        // 1️⃣ Fetch requester's donor entry to get location
        const donorSnapshot = await db.collection("donors")
            .where("donorId", "==", requesterUid)
            .limit(1)
            .get();

        if (donorSnapshot.empty) {
            console.log("❌ Requesting user is not a registered donor.");
            return;
        }

        const donorData = donorSnapshot.docs[0].data();
        const { latitude, longitude } = donorData;

        console.log(`📍 Requester Location Found: Latitude: ${latitude}, Longitude: ${longitude}`);

        // 2️⃣ Find donors with the same blood type within 10km
        console.log(`🔍 Searching for donors with blood type: ${bloodType}...`);
        const donorsSnapshot = await db.collection("donors")
            .where("bloodType", "==", bloodType)
            .where("isDonor", "==", true)
            .get();

        console.log(`📌 Total Donors Found: ${donorsSnapshot.size}`);

        let eligibleDonorIds = [];

        donorsSnapshot.forEach(doc => {
            const donor = doc.data();
            if (!donor.latitude || !donor.longitude) return;

            const distance = haversine(
                { lat: latitude, lon: longitude },
                { lat: donor.latitude, lon: donor.longitude }
            );

            console.log(`🧭 Distance to donor ${donor.donorId}: ${distance.toFixed(2)} meters`);

            if (distance <= 10000) {
                console.log(`✅ Donor ${donor.donorId} is within 10km!`);
                eligibleDonorIds.push(donor.donorId); // Store donor's uid
            }
        });

        // 🛠 **Fix: Ensure array is valid before querying Firestore**
        eligibleDonorIds = eligibleDonorIds.filter(id => id); // Remove undefined/null values

        console.log(`🎯 Eligible Donors within 10km: ${eligibleDonorIds.length}`);

        if (eligibleDonorIds.length === 0) {
            console.log("⚠️ No donors found within 10km for blood type:", bloodType);
            return;
        }

        // 3️⃣ Fetch FCM tokens from users collection
        console.log("🔍 Fetching FCM tokens for eligible donors...");
        const fcmTokens = [];

        if (eligibleDonorIds.length > 0) {  // ✅ Prevents Firestore error
            const usersSnapshot = await db.collection("users")
                .where("uid", "in", eligibleDonorIds)
                .get();

            console.log(`📌 Total Users Matching Donor UIDs: ${usersSnapshot.size}`);

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.fcmToken) {
                    console.log(`📲 FCM Token Found for User: ${doc.id}`);
                    fcmTokens.push(userData.fcmToken);
                } else {
                    console.log(`⚠️ No FCM Token for User: ${doc.id}`);
                }
            });
        }

        console.log(`✅ Total FCM Tokens Retrieved: ${fcmTokens.length}`);

        if (fcmTokens.length === 0) {
            console.log("⚠️ No FCM tokens found for eligible donors.");
            return;
        }

        // 4️⃣ Send emergency notifications
        const payload = {
            notification: {
                title: "🚨 Emergency Blood Request!",
                body: `Urgent need for ${bloodType} blood near your location.`,
            },
            data: {
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                bloodType: bloodType,
                type: "emergency"
            }
        };

        console.log(`📲 Sending notifications to ${fcmTokens.length} donors...`);

        await admin.messaging().sendEachForMulticast({
            tokens: fcmTokens,
            notification: payload.notification,
            data: payload.data
        });

        console.log("✅ Emergency alert sent successfully!");
    } catch (error) {
        console.error("❌ Error sending emergency notification:", error);
    }
}

module.exports = { requestEmergencyBlood };
