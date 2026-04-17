# Firebase Setup Guide

## Overview
This application uses Firebase Firestore to store metadata about the last 5 CSV files uploaded. This allows users to quickly reload previous files.

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name the project "flipndip-order-report"
4. Enable Google Analytics (optional)
5. Create the project

### 2. Set Up Firestore Database

1. In Firebase Console, select your project
2. Go to "Build" → "Firestore Database"
3. Click "Create database"
4. Choose "Start in production mode"
5. Select a location (e.g., us-central1)
6. Create the database

### 3. Set Firestore Security Rules

1. In Firestore, go to "Rules" tab
2. Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /csvFiles/{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

⚠️ **Note**: These are permissive rules for development. For production, you should implement proper authentication and security rules.

### 4. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (⚙️ icon)
2. Scroll to "Your apps" section
3. Click on the Web app (if not created, click "Add app" and select "Web")
4. Copy the Firebase configuration object

### 5. Add Configuration to the App

1. Open or create `firebase-config.js` in the project root
2. Replace the `firebaseConfig` object with your own configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 6. Verify Setup

1. Open the application in a browser
2. Upload a CSV file
3. Check the browser console for any errors
4. You should see "CSV metadata saved to Firebase" message
5. The recent files section should appear at the top of the page

## Features

- ✅ Automatically saves CSV file metadata (filename and upload timestamp) to Firebase
- ✅ Displays the last 5 uploaded CSV files in a "Recent Files" section
- ✅ Recent files appear at the top of the page with timestamp
- ✅ Clicking a recent file button shows a message (to be implemented for actual loading)

## Future Enhancements

- Implement actual CSV content storage and retrieval
- Add user authentication to track uploads per user
- Implement CSV content search/filtering
- Add delete functionality for old files

## Troubleshooting

**"Failed to fetch" errors**: Check that your API key is correct and CORS is properly configured in Firebase.

**Recent files not showing**: 
- Check browser console for errors
- Verify Firestore rules allow read access
- Ensure Firebase project ID is correct

**Firebase not found**: Make sure firebase-config.js is in the project root and properly configured.
