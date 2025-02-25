const admin = require("firebase-admin");
const axios = require("axios");

const saveSettings = async (userId, locationEnabled, notificationsEnabled, darkModeEnabled) => {
  try {
    // Save settings to Firestore
    const db = admin.firestore();
    await db.collection('settings').doc(userId).set({
      locationEnabled,
      notificationsEnabled,
      darkModeEnabled,
    });

    // Define the external API URL
    const url = 'http://localhost:5000/save-settings'; // Replace with your actual API URL

    // Optional: Call an external API to save the settings
    const response = await axios.post(
      url,
      {
        userId: userId,
        locationEnabled: locationEnabled,
        notificationsEnabled: notificationsEnabled,
        darkModeEnabled: darkModeEnabled,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 200) {
      console.log('Settings saved successfully to external API.');
    } else {
      console.error('Failed to save settings to the external API.');
    }

    return { success: true, message: 'Settings saved successfully' };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  saveSettings,
};
